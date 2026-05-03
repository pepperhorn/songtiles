import type { Tile, TileId } from './types';
import { cellKey } from './types';
import { neighbors } from './adjacency';

export interface Segment {
  rootId: TileId;
  tiles: TileId[];                  // walk-order, ends at endpoint or intersection inclusive
  endsAtIntersection: boolean;
  /**
   * Off-line branches at intersection tiles INSIDE the segment (not the
   * terminal one). Keyed by the tile id of the intersection. Each value lists
   * branch-root tile ids — those are themselves segment roots in the result.
   *
   * Populated only when the segment crosses an intersection that sits inside
   * a positional repeat section: the segment continues along the section line
   * instead of splitting, and the off-line neighbours are recorded here so
   * playback can fork them on the LAST loop iteration.
   */
  branchesByTile?: Record<TileId, TileId[]>;
}

/**
 * Find repeat sections. A section is anchored by a single repeat tile that
 * sits at the end of a strand (exactly one non-repeat neighbour). Walking
 * away from the repeat in that direction collects every consecutive note
 * tile until a non-note tile or empty cell terminates the line.
 *
 * Returns one entry per repeat. `lineIds` lists tiles in playhead order:
 * the far end first, the repeat tile last.
 */
export interface RepeatSection {
  repeatId: TileId;
  lineIds: TileId[];
  /** Step from far end → repeat. */
  step: { dx: number; dy: number };
}

export function findRepeatSections(
  tiles: Record<TileId, Tile>,
  byCell: Record<string, TileId>,
): RepeatSection[] {
  const out: RepeatSection[] = [];
  const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
  for (const r of Object.values(tiles)) {
    if (r.kind !== 'repeat' || !r.cell) continue;
    const c = r.cell;
    // Find the single non-repeat neighbour. If 0 or 2+, skip — the repeat
    // is either floating or sitting at an intersection.
    let outDir: { dx: number; dy: number } | null = null;
    let count = 0;
    for (const d of dirs) {
      const nbr = byCell[cellKey({ x: c.x + d.x, y: c.y + d.y })];
      if (nbr && tiles[nbr]?.kind !== 'repeat') {
        count++;
        outDir = { dx: -d.x, dy: -d.y }; // step from far end → repeat
      }
    }
    if (count !== 1 || !outDir) continue;
    // Walk from the repeat in the OPPOSITE of outDir until end or non-note.
    const reverse = { dx: -outDir.dx, dy: -outDir.dy };
    const reversed: TileId[] = [];
    let x = c.x, y = c.y;
    while (true) {
      x += reverse.dx;
      y += reverse.dy;
      const id = byCell[cellKey({ x, y })];
      if (!id) break;
      const t = tiles[id];
      if (!t || t.kind !== 'note') break;
      reversed.push(id);
    }
    if (reversed.length === 0) continue;
    // lineIds: far end first → repeat last (playhead order if entering from far end).
    out.push({
      repeatId: r.id,
      lineIds: [...reversed.reverse(), r.id],
      step: outDir,
    });
  }
  return out;
}

export function computeSegments(
  startId: TileId,
  tiles: Record<TileId, Tile>,
  byCell: Record<string, TileId>,
): Segment[] {
  const segments: Segment[] = [];

  // Index every tile that lies INSIDE a repeat section by the section's
  // line direction. Mid-line intersections of these tiles will continue the
  // segment along that direction instead of splitting, so the entire line
  // (including the repeat marker) ends up in one segment for stack pairing.
  const sections = findRepeatSections(tiles, byCell);
  const sectionDir = new Map<TileId, { dx: number; dy: number }>();
  for (const s of sections) {
    for (const id of s.lineIds) sectionDir.set(id, s.step);
  }

  interface FrontierEntry { root: TileId; prev: TileId | null }
  const queue: FrontierEntry[] = [{ root: startId, prev: null }];
  const visited = new Set<TileId>();

  while (queue.length > 0) {
    const { root, prev } = queue.shift()!;
    if (visited.has(root)) continue;
    visited.add(root);

    const segTiles: TileId[] = [root];
    let cur = root;
    let last = prev;
    let endsAtIntersection = false;
    let branchesByTile: Record<TileId, TileId[]> | undefined;

    let done = false;
    while (!done) {
      const ns = neighbors(cur, tiles, byCell).filter(n => n !== last);

      if (ns.length === 1) {
        const next = ns[0];
        if (visited.has(next)) {
          done = true;
        } else {
          visited.add(next);
          segTiles.push(next);
          last = cur;
          cur = next;
        }
      } else if (ns.length === 0) {
        done = true;
      } else {
        // Intersection. If the current tile is inside a positional repeat
        // section AND one of its outgoing neighbours sits along the section
        // line (either direction), continue along the line; record the rest
        // as branches and queue them as separate segments. Otherwise behave
        // as before.
        const dir = sectionDir.get(cur);
        const curTile = tiles[cur];
        let onLineNext: TileId | null = null;
        if (dir && curTile?.cell) {
          for (const sign of [1, -1]) {
            const nextCell = { x: curTile.cell.x + sign * dir.dx, y: curTile.cell.y + sign * dir.dy };
            const candidate = byCell[cellKey(nextCell)];
            if (candidate && ns.includes(candidate) && !visited.has(candidate)) {
              onLineNext = candidate;
              break;
            }
          }
        }

        if (onLineNext) {
          // Branch: every other outgoing neighbour spawns its own segment.
          // Pass `prev = cur` so the branch walks away from us. Record the
          // branch roots so playback can fork them on the final loop pass.
          const branches = ns.filter(n => n !== onLineNext);
          if (branches.length > 0) {
            branchesByTile = branchesByTile ?? {};
            branchesByTile[cur] = branches;
            for (const b of branches) {
              if (!visited.has(b)) queue.push({ root: b, prev: cur });
            }
          }
          if (visited.has(onLineNext)) {
            done = true;
          } else {
            visited.add(onLineNext);
            segTiles.push(onLineNext);
            last = cur;
            cur = onLineNext;
          }
        } else {
          // Standard split at intersection.
          endsAtIntersection = true;
          for (const branch of ns) {
            if (!visited.has(branch)) queue.push({ root: branch, prev: cur });
          }
          done = true;
        }
      }
    }

    segments.push({
      rootId: root,
      tiles: segTiles,
      endsAtIntersection,
      ...(branchesByTile ? { branchesByTile } : {}),
    });
  }

  return segments;
}
