import { describe, it, expect } from 'vitest';
import type { Tile, TileId } from '../../src/graph/types';
import { cellKey } from '../../src/graph/types';
import { computeSegments } from '../../src/graph/segments';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTile(id: TileId, x: number, y: number): Tile {
  return { id, kind: 'note', pitch: 60, bass: false, cell: { x, y } };
}

function buildGraph(positions: [TileId, number, number][]): {
  tiles: Record<TileId, Tile>;
  byCell: Record<string, TileId>;
} {
  const tiles: Record<TileId, Tile> = {};
  const byCell: Record<string, TileId> = {};
  for (const [id, x, y] of positions) {
    tiles[id] = makeTile(id, x, y);
    byCell[cellKey({ x, y })] = id;
  }
  return { tiles, byCell };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeSegments', () => {
  it('linear a-b-c from start a → one segment [a,b,c]', () => {
    // a–b–c (horizontal)
    const { tiles, byCell } = buildGraph([
      ['a', 0, 0],
      ['b', 1, 0],
      ['c', 2, 0],
    ]);

    const segs = computeSegments('a', tiles, byCell);

    expect(segs).toHaveLength(1);
    expect(segs[0].tiles).toEqual(['a', 'b', 'c']);
    expect(segs[0].endsAtIntersection).toBe(false);
  });

  it('a-c-b with intersection at b and branches n, e, s → 4 segments', () => {
    // Layout:
    //       n (1,0)
    //       |
    // a(0,1)–c(1,1)–b(2,1)–e(3,1)
    //                |
    //               s(2,2)
    //
    // start = a, walk to c then b; b has 3 outgoing neighbours after c: n, e, s
    const { tiles, byCell } = buildGraph([
      ['a', 0, 1],
      ['c', 1, 1],
      ['b', 2, 1],
      ['n', 2, 0],
      ['e', 3, 1],
      ['s', 2, 2],
    ]);

    const segs = computeSegments('a', tiles, byCell);

    // Should produce 4 segments total
    expect(segs).toHaveLength(4);

    // First segment is the walk from start up to and including the intersection
    expect(segs[0].tiles).toEqual(['a', 'c', 'b']);
    expect(segs[0].endsAtIntersection).toBe(true);

    // Remaining three segments are the single-tile arms rooted at n, e, s (any order)
    const armTiles = segs.slice(1).map(s => s.tiles[0]).sort();
    expect(armTiles).toEqual(['e', 'n', 's'].sort());

    // Each arm is a single tile that is a true endpoint
    for (const seg of segs.slice(1)) {
      expect(seg.tiles).toHaveLength(1);
      expect(seg.endsAtIntersection).toBe(false);
    }
  });
});
