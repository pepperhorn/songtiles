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
 * Find positional repeat pairs. A pair is two repeat tiles on the same row
 * or column with no gaps between them. The first/leading tile (smaller x or
 * y) becomes the section "open" and supplies the count.
 *
 * Returns one entry per pair with the inclusive list of tile ids on the
 * section line plus the direction step used to walk it.
 */
export interface PositionalPair {
  openId: TileId;       // leading (smaller x/y) repeat tile
  closeId: TileId;      // trailing repeat tile
  lineIds: TileId[];    // inclusive open..close
  step: { dx: number; dy: number };
}

export function findPositionalRepeatPairs(
  tiles: Record<TileId, Tile>,
  byCell: Record<string, TileId>,
): PositionalPair[] {
  const repeats = Object.values(tiles).filter(t => t.kind === 'repeat' && t.cell);
  const used = new Set<TileId>();
  const out: PositionalPair[] = [];

  // For each pair (a, b) we consider, prefer the closest neighbour on the
  // same line. Sort all candidate pairs by distance to greedily pair.
  type Candidate = { a: typeof repeats[number]; b: typeof repeats[number]; dist: number; lineIds: TileId[]; step: { dx: number; dy: number } };
  const candidates: Candidate[] = [];
  for (let i = 0; i < repeats.length; i++) {
    for (let j = i + 1; j < repeats.length; j++) {
      const ra = repeats[i], rb = repeats[j];
      const ac = ra.cell!, bc = rb.cell!;
      const dx = bc.x - ac.x, dy = bc.y - ac.y;
      if ((dx !== 0 && dy !== 0) || (dx === 0 && dy === 0)) continue;
      const steps = Math.abs(dx + dy);
      const sx = Math.sign(dx), sy = Math.sign(dy);
      const lineIds: TileId[] = [];
      let ok = true;
      for (let k = 0; k <= steps; k++) {
        const id = byCell[cellKey({ x: ac.x + sx * k, y: ac.y + sy * k })];
        if (!id) { ok = false; break; }
        lineIds.push(id);
      }
      if (!ok) continue;
      candidates.push({ a: ra, b: rb, dist: steps, lineIds, step: { dx: sx, dy: sy } });
    }
  }
  candidates.sort((p, q) => p.dist - q.dist);

  for (const c of candidates) {
    if (used.has(c.a.id) || used.has(c.b.id)) continue;
    // Always order leading→trailing so step is positive.
    const leading = (c.step.dx + c.step.dy) > 0 ? c.a : c.b;
    const trailing = leading === c.a ? c.b : c.a;
    used.add(leading.id);
    used.add(trailing.id);
    out.push({
      openId: leading.id,
      closeId: trailing.id,
      lineIds: c.lineIds,
      step: c.step,
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

  // Index every tile that lies INSIDE a positional repeat section by its
  // section's line direction. Mid-line intersections of these tiles will
  // continue the segment along that direction instead of splitting.
  const pairs = findPositionalRepeatPairs(tiles, byCell);
  // tileId → { dx, dy } (line step), only for tiles that are interior to a
  // pair (between open and close inclusive).
  const sectionDir = new Map<TileId, { dx: number; dy: number }>();
  for (const p of pairs) {
    for (const id of p.lineIds) sectionDir.set(id, p.step);
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
