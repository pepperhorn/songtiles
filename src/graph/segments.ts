import type { Tile, TileId } from './types';
import { neighbors } from './adjacency';

export interface Segment {
  rootId: TileId;
  tiles: TileId[];                  // walk-order, ends at endpoint or intersection inclusive
  endsAtIntersection: boolean;
}

export function computeSegments(
  startId: TileId,
  tiles: Record<TileId, Tile>,
  byCell: Record<string, TileId>,
): Segment[] {
  const segments: Segment[] = [];

  // BFS frontier: each entry is { root, prev } where prev is the tile we came
  // from (null for the very first segment, since startId has no predecessor).
  interface FrontierEntry { root: TileId; prev: TileId | null }

  const queue: FrontierEntry[] = [{ root: startId, prev: null }];
  const visited = new Set<TileId>();

  while (queue.length > 0) {
    const { root, prev } = queue.shift()!;

    if (visited.has(root)) continue;

    visited.add(root);

    // Walk forward from root, away from prev.
    const segTiles: TileId[] = [root];
    let cur = root;
    let last = prev;
    let endsAtIntersection = false;

    let done = false;
    while (!done) {
      const ns = neighbors(cur, tiles, byCell).filter(n => n !== last);

      if (ns.length === 1) {
        // Continue the segment along the single outgoing neighbour.
        const next = ns[0];
        if (visited.has(next)) {
          // Cycle guard: treat as endpoint.
          done = true;
        } else {
          visited.add(next);
          segTiles.push(next);
          last = cur;
          cur = next;
        }
      } else if (ns.length === 0) {
        // Endpoint — current tile is the last; segment is done.
        done = true;
      } else {
        // Intersection (2+ outgoing): current tile is the last of this segment.
        // Enqueue each outgoing branch as a new segment rooted at that branch.
        endsAtIntersection = true;
        for (const branch of ns) {
          if (!visited.has(branch)) {
            queue.push({ root: branch, prev: cur });
          }
        }
        done = true;
      }
    }

    segments.push({ rootId: root, tiles: segTiles, endsAtIntersection });
  }

  return segments;
}
