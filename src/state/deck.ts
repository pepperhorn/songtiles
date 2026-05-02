import type { NoteTile, TileId } from '../graph/types';
import { newTileId } from '../utils/id';

/** Pure data — no class methods. Field names match the plan. */
export interface DeckRecord {
  /** Tile id → Tile for every tile that still exists (canvas + tray + deck; NOT discarded). */
  tiles: Record<TileId, NoteTile>;
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
 * Build a shuffled 144-tile deck covering MIDI pitches C2..C6 (36..84).
 * 49 pitches × 3 copies = 147 → trimmed to 144.
 */
export function createDeck(rng?: Rng): DeckRecord {
  const pitches: number[] = [];
  for (let midi = 36; midi <= 84; midi++) pitches.push(midi, midi, midi);
  pitches.length = 144;
  shuffle(pitches, rng);

  const tiles: Record<TileId, NoteTile> = {};
  const deck: TileId[] = [];
  for (const pitch of pitches) {
    const id = newTileId();
    tiles[id] = { id, kind: 'note', pitch, bass: false, cell: null };
    deck.push(id);
  }
  return { tiles, deck, tray: [], discardedCount: 0 };
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
