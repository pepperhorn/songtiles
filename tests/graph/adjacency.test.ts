import { describe, it, expect } from 'vitest';
import type { Tile, TileId } from '../../src/graph/types';
import { cellKey } from '../../src/graph/types';
import {
  neighbors,
  isEndpoint,
  isIntersection,
  isAdjacentToGraph,
  wouldDisconnect,
} from '../../src/graph/adjacency';

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

describe('neighbors', () => {
  it('returns the correct orthogonal neighbours for a middle tile in a straight line', () => {
    // A–B–C  (horizontal)
    const { tiles, byCell } = buildGraph([
      ['A', 0, 0],
      ['B', 1, 0],
      ['C', 2, 0],
    ]);
    expect(neighbors('B', tiles, byCell).sort()).toEqual(['A', 'C'].sort());
  });

  it('returns an empty array when a tile has no neighbours', () => {
    const { tiles, byCell } = buildGraph([['A', 0, 0]]);
    expect(neighbors('A', tiles, byCell)).toHaveLength(0);
  });
});

describe('isEndpoint', () => {
  it('returns true for a tile with exactly 1 neighbour', () => {
    const { tiles, byCell } = buildGraph([
      ['A', 0, 0],
      ['B', 1, 0],
    ]);
    expect(isEndpoint('A', tiles, byCell)).toBe(true);
    expect(isEndpoint('B', tiles, byCell)).toBe(true);
  });

  it('returns false for a tile with 2 neighbours', () => {
    const { tiles, byCell } = buildGraph([
      ['A', 0, 0],
      ['B', 1, 0],
      ['C', 2, 0],
    ]);
    expect(isEndpoint('B', tiles, byCell)).toBe(false);
  });
});

describe('isIntersection', () => {
  it('returns true for a tile with 3+ neighbours', () => {
    // Cross shape: centre at (1,1) with 4 arms
    const { tiles, byCell } = buildGraph([
      ['N', 1, 0],
      ['W', 0, 1],
      ['C', 1, 1],
      ['E', 2, 1],
      ['S', 1, 2],
    ]);
    expect(isIntersection('C', tiles, byCell)).toBe(true);
  });

  it('returns false for a tile with 2 neighbours', () => {
    const { tiles, byCell } = buildGraph([
      ['A', 0, 0],
      ['B', 1, 0],
      ['C', 2, 0],
    ]);
    expect(isIntersection('B', tiles, byCell)).toBe(false);
  });
});

describe('isAdjacentToGraph', () => {
  it('accepts any cell when the graph is empty', () => {
    expect(isAdjacentToGraph({ x: 5, y: 7 }, {}, {})).toBe(true);
  });

  it('accepts a cell orthogonally adjacent to an existing tile', () => {
    const { tiles, byCell } = buildGraph([['A', 0, 0]]);
    expect(isAdjacentToGraph({ x: 1, y: 0 }, tiles, byCell)).toBe(true);
  });

  it('rejects a cell that is not adjacent and is not in an empty graph', () => {
    const { tiles, byCell } = buildGraph([['A', 0, 0]]);
    expect(isAdjacentToGraph({ x: 2, y: 0 }, tiles, byCell)).toBe(false);
  });

  it('rejects a cell that is already occupied', () => {
    const { tiles, byCell } = buildGraph([['A', 0, 0]]);
    expect(isAdjacentToGraph({ x: 0, y: 0 }, tiles, byCell)).toBe(false);
  });
});

describe('wouldDisconnect', () => {
  it('returns false when the graph has only one tile', () => {
    const { tiles, byCell } = buildGraph([['A', 0, 0]]);
    expect(wouldDisconnect('A', tiles, byCell)).toBe(false);
  });

  it('returns false for an endpoint in a straight line', () => {
    const { tiles, byCell } = buildGraph([
      ['A', 0, 0],
      ['B', 1, 0],
      ['C', 2, 0],
    ]);
    expect(wouldDisconnect('A', tiles, byCell)).toBe(false);
    expect(wouldDisconnect('C', tiles, byCell)).toBe(false);
  });

  it('returns true for a bridge tile whose removal splits the graph', () => {
    // A–B–C: removing B splits A from C
    const { tiles, byCell } = buildGraph([
      ['A', 0, 0],
      ['B', 1, 0],
      ['C', 2, 0],
    ]);
    expect(wouldDisconnect('B', tiles, byCell)).toBe(true);
  });

  it('returns false for an interior tile in a cycle', () => {
    // Square loop: (0,0)–(1,0)–(1,1)–(0,1)–(0,0)
    const { tiles, byCell } = buildGraph([
      ['A', 0, 0],
      ['B', 1, 0],
      ['C', 1, 1],
      ['D', 0, 1],
    ]);
    // Each tile in the loop has 2 neighbours; removing any keeps the rest connected
    expect(wouldDisconnect('A', tiles, byCell)).toBe(false);
    expect(wouldDisconnect('B', tiles, byCell)).toBe(false);
  });
});
