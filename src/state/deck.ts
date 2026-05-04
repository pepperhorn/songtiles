import type { Tile, TileId, RepeatTile, GameMode, ScaleRoot, ScaleType, Wildness } from '../graph/types';
import { WILDNESS_RATIO, SCALE_INTERVALS } from '../graph/types';
import { newTileId } from '../utils/id';

/** Pure data — no class methods. */
export interface DeckRecord {
  /** Tile id → Tile (notes + repeat wildcards). Lives until tile is discarded. */
  tiles: Record<TileId, Tile>;
  /** Ordered list of tile ids still in the deck (index 0 = top). */
  deck: TileId[];
  /** Ids currently in the tray (visual order). */
  tray: TileId[];
  /** Number of tiles permanently discarded this session. */
  discardedCount: number;
}

type Rng = () => number;

function shuffle<T>(arr: T[], rng: Rng = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface CreateDeckOptions {
  mode: GameMode;
  /** Wildcard density (percentage of note-tile count). */
  wildness: Wildness;
  /** Required when mode === 'scale'. */
  scaleRoot?: ScaleRoot;
  scaleType?: ScaleType;
  /** Optional — for tests. */
  rng?: Rng;
}

/**
 * Build a shuffled deck.
 *
 * Explorer mode: 12 instances of every pitch class (C..B), distributed
 * across midi 36..83 so each PC has 4 octaves × 3 copies = 12 tiles. Total
 * 144 note tiles.
 *
 * Scale mode: 12 instances of every pitch class IN the chosen scale (e.g.
 * 7 PCs for major / minor), distributed the same way (4 in-range octaves
 * × 3 copies). Total = 12 × |scale|. Other PCs are excluded entirely.
 *
 * Wildcards (currently just Repeat tiles) are mixed in proportional to the
 * note count: round(notes * wildness%). Wildness ratios in graph/types.
 */
export function createDeck(opts: CreateDeckOptions): DeckRecord {
  const tiles: Record<TileId, Tile> = {};
  const ids: TileId[] = [];
  const rng = opts.rng;

  // Determine which pitch classes to include.
  let pcSet: Set<number>;
  if (opts.mode === 'scale') {
    if (opts.scaleRoot === undefined || opts.scaleType === undefined) {
      throw new Error('scaleRoot and scaleType are required for scale mode');
    }
    const intervals = SCALE_INTERVALS[opts.scaleType];
    pcSet = new Set(intervals.map(s => (opts.scaleRoot! + s) % 12));
  } else {
    pcSet = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  }

  // For each PC, pick 4 in-range octaves (midi 36..83 = 4 octaves) and lay
  // down 3 copies of each → 12 instances per PC.
  for (let pc = 0; pc < 12; pc++) {
    if (!pcSet.has(pc)) continue;
    // Octave bases: 36 (C2), 48 (C3), 60 (C4), 72 (C5). Skip 84 (C6) so all
    // PCs get the same count (84 + 11 = 95 > 84 → only C reaches 84).
    for (const base of [36, 48, 60, 72]) {
      const midi = base + pc;
      if (midi > 83) continue;
      for (let copy = 0; copy < 3; copy++) {
        const id = newTileId();
        tiles[id] = { id, kind: 'note', pitch: midi, bass: false, cell: null };
        ids.push(id);
      }
    }
  }

  // Wildcards — proportional to note count.
  const noteCount = ids.length;
  const wildcardCount = Math.round(noteCount * WILDNESS_RATIO[opts.wildness]);
  for (let i = 0; i < wildcardCount; i++) {
    const id = newTileId();
    const tile: RepeatTile = { id, kind: 'repeat', count: 1, cell: null };
    tiles[id] = tile;
    ids.push(id);
  }

  shuffle(ids, rng);
  return { tiles, deck: ids, tray: [], discardedCount: 0 };
}

export function drawTo(record: DeckRecord, capacity: number): DeckRecord {
  const needed = capacity - record.tray.length;
  if (needed <= 0) return record;

  const newDeck = [...record.deck];
  const newTray = [...record.tray];
  const toDraw = Math.min(needed, newDeck.length);
  for (let i = 0; i < toDraw; i++) newTray.push(newDeck.shift()!);
  return { ...record, deck: newDeck, tray: newTray };
}

export function returnToDeck(record: DeckRecord, id: TileId): DeckRecord {
  return {
    ...record,
    tray: record.tray.filter(t => t !== id),
    deck: [...record.deck, id],
  };
}

export function discardFromTray(record: DeckRecord, id: TileId): DeckRecord {
  if (!record.tray.includes(id)) return record;
  const { [id]: _gone, ...tiles } = record.tiles;
  void _gone;
  return {
    ...record,
    tiles,
    tray: record.tray.filter(t => t !== id),
    discardedCount: record.discardedCount + 1,
  };
}
