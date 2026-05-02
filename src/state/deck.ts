import type { Tile, TileId, RepeatOpenTile, RepeatCloseTile } from '../graph/types';
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

/**
 * Build a shuffled deck of 144 note tiles (MIDI 36..84, 3 copies each, trimmed
 * to 144) plus `repeatSets` repeat-open / repeat-close pairs mixed in.
 *
 * Total deck size = 144 + 2 * repeatSets. Wildcards occupy tray slots when
 * drawn just like notes do.
 */
export function createDeck(repeatSets = 0, rng?: Rng): DeckRecord {
  const tiles: Record<TileId, Tile> = {};
  const ids: TileId[] = [];

  // Note tiles.
  const pitches: number[] = [];
  for (let midi = 36; midi <= 84; midi++) pitches.push(midi, midi, midi);
  pitches.length = 144;
  for (const pitch of pitches) {
    const id = newTileId();
    tiles[id] = { id, kind: 'note', pitch, bass: false, cell: null };
    ids.push(id);
  }

  // Repeat wildcards (1 open + 1 close per set), shuffled in alongside the notes.
  for (let i = 0; i < repeatSets; i++) {
    const openId = newTileId();
    const closeId = newTileId();
    const open: RepeatOpenTile = { id: openId, kind: 'repeat-open', count: 1, cell: null };
    const close: RepeatCloseTile = { id: closeId, kind: 'repeat-close', cell: null };
    tiles[openId] = open;
    tiles[closeId] = close;
    ids.push(openId, closeId);
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
