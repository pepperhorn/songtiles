import type { Cell, Tile, TileId } from './types';
import { cellKey } from './types';

const DIRS: Cell[] = [
  { x: 1,  y: 0 },
  { x: -1, y: 0 },
  { x: 0,  y: 1 },
  { x: 0,  y: -1 },
];

/** Returns the IDs of all orthogonally adjacent placed tiles. */
export function neighbors(
  id: TileId,
  tiles: Record<TileId, Tile>,
  byCell: Record<string, TileId>,
): TileId[] {
  const tile = tiles[id];
  if (!tile?.cell) return [];
  const result: TileId[] = [];
  for (const dir of DIRS) {
    const key = cellKey({ x: tile.cell.x + dir.x, y: tile.cell.y + dir.y });
    const neighbourId = byCell[key];
    if (neighbourId !== undefined && neighbourId !== id) {
      result.push(neighbourId);
    }
  }
  return result;
}

/** True when the tile has exactly 1 orthogonal neighbour (a path endpoint). */
export const isEndpoint = (
  id: TileId,
  tiles: Record<TileId, Tile>,
  byCell: Record<string, TileId>,
): boolean => neighbors(id, tiles, byCell).length === 1;

/** True when the tile has 3 or more orthogonal neighbours (a junction). */
export const isIntersection = (
  id: TileId,
  tiles: Record<TileId, Tile>,
  byCell: Record<string, TileId>,
): boolean => neighbors(id, tiles, byCell).length >= 3;

/**
 * True when `cell` is legally placeable:
 * - The graph is empty (first tile), OR
 * - The cell is orthogonally adjacent to at least one existing tile AND is not occupied.
 */
export function isAdjacentToGraph(
  cell: Cell,
  tiles: Record<TileId, Tile>,
  byCell: Record<string, TileId>,
): boolean {
  // Reject if cell is already occupied.
  if (byCell[cellKey(cell)] !== undefined) return false;

  // First tile: empty graph always accepts.
  const placedCount = Object.values(tiles).filter(t => t.cell).length;
  if (placedCount === 0) return true;

  // Must touch at least one existing tile orthogonally.
  for (const dir of DIRS) {
    const key = cellKey({ x: cell.x + dir.x, y: cell.y + dir.y });
    if (byCell[key] !== undefined) return true;
  }
  return false;
}

/**
 * True when removing `id` from the graph would split the remaining tiles into
 * two or more disconnected components (i.e., `id` is a bridge/articulation point).
 *
 * Returns false for isolated tiles (0 neighbours) and simple endpoints (1 neighbour).
 */
export function wouldDisconnect(
  id: TileId,
  tiles: Record<TileId, Tile>,
  byCell: Record<string, TileId>,
): boolean {
  const tile = tiles[id];
  if (!tile?.cell) return false;

  // Collect all placed tile IDs except the one being removed.
  const remaining = Object.values(tiles)
    .filter(t => t.cell && t.id !== id)
    .map(t => t.id);

  if (remaining.length === 0) return false;

  // Find which of the remaining tiles are neighbours of `id`.
  const ns = neighbors(id, tiles, byCell);

  // 0 or 1 neighbours: removing won't disconnect anyone.
  if (ns.length <= 1) return false;

  // BFS from the first neighbour over the remaining graph (excluding `id`).
  const visited = new Set<TileId>();
  const queue: TileId[] = [ns[0]];
  visited.add(ns[0]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const nbr of neighbors(current, tiles, byCell)) {
      if (nbr === id) continue; // skip the tile being removed
      if (!visited.has(nbr)) {
        visited.add(nbr);
        queue.push(nbr);
      }
    }
  }

  // If any remaining tile wasn't reached, the graph would split.
  return remaining.some(r => !visited.has(r));
}
