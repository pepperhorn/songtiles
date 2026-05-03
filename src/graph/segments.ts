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
 * Compute positional repeat pairs: for each placed `repeat-open`, find the
 * nearest unused `repeat-close` on the same row or column with no gaps. This
 * mirrors the visual pairing used by the canvas (yellow section ring).
 *
 * Returns a map from open tile id → { closeId, lineIds, dir } where lineIds
 * is the inclusive list of tile ids on the section line and dir is the
 * direction step used to walk it.
 */
export interface PositionalPair {
  openId: TileId;
  closeId: TileId;
  lineIds: TileId[];                  // inclusive open..close
  step: { dx: number; dy: number };
}

export function findPositionalRepeatPairs(
  tiles: Record<TileId, Tile>,
  byCell: Record<string, TileId>,
): PositionalPair[] {
  const opens = Object.values(tiles).filter(t => t.kind === 'repeat-open' && t.cell);
  const closes = Object.values(tiles).filter(t => t.kind === 'repeat-close' && t.cell);
  const used = new Set<TileId>();
  const out: PositionalPair[] = [];

  for (const o of opens) {
    const oc = o.cell!;
    let best: PositionalPair | null = null;
    let bestDist = Infinity;
    for (const c of closes) {
      if (used.has(c.id)) continue;
      const cc = c.cell!;
      const dx = cc.x - oc.x;
      const dy = cc.y - oc.y;
      if ((dx !== 0 && dy !== 0) || (dx === 0 && dy === 0)) continue;
      const steps = Math.abs(dx + dy);
      const sx = Math.sign(dx);
      const sy = Math.sign(dy);
      const lineIds: TileId[] = [];
      let ok = true;
      for (let k = 0; k <= steps; k++) {
        const id = byCell[cellKey({ x: oc.x + sx * k, y: oc.y + sy * k })];
        if (!id) { ok = false; break; }
        lineIds.push(id);
      }
      if (!ok) continue;
      if (steps < bestDist) {
        bestDist = steps;
        best = { openId: o.id, closeId: c.id, lineIds, step: { dx: sx, dy: sy } };
      }
    }
    if (best) {
      used.add(best.closeId);
      out.push(best);
    }
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
        // line, continue along the line; record the rest as branches and
        // queue them as separate segments. Otherwise behave as before.
        const dir = sectionDir.get(cur);
        const curTile = tiles[cur];
        let onLineNext: TileId | null = null;
        if (dir && curTile?.cell) {
          const nextCell = { x: curTile.cell.x + dir.dx, y: curTile.cell.y + dir.dy };
          const candidate = byCell[cellKey(nextCell)];
          if (candidate && ns.includes(candidate)) onLineNext = candidate;
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
