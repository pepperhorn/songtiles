import type { NoteTile, TileId } from '../graph/types';
import { newTileId } from '../utils/id';

/** Everything the deck needs to track. Pure data — no class methods. */
export interface DeckRecord {
  /** Ordered list of tile ids still in the deck (index 0 = top). */
  order: TileId[];
  /** Tile id → NoteTile for every tile that still exists (deck + tray; NOT discarded). */
  registry: Map<TileId, NoteTile>;
  /** Ids currently in the tray (order matches visual tray order). */
  tray: TileId[];
  /** Number of tiles permanently discarded this session. */
  discardedCount: number;
}

type Rng = () => number;

/** Fisher–Yates in-place shuffle using the supplied rng (default Math.random). */
function shuffle<T>(arr: T[], rng: Rng = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Build a shuffled 144-tile deck covering MIDI pitches C2..C6 (36..84),
 * 3 copies of each of the 49 pitches = 147 tiles → trim to 144.
 * Each tile starts with cell = null (not placed on canvas).
 */
export function createDeck(rng?: Rng): DeckRecord {
  const pitches: number[] = [];
  for (let midi = 36; midi <= 84; midi++) {
    pitches.push(midi, midi, midi); // 3 copies
  }
  // 49 pitches × 3 = 147 → trim to 144
  pitches.length = 144;

  shuffle(pitches, rng);

  const registry = new Map<TileId, NoteTile>();
  const order: TileId[] = [];

  for (const pitch of pitches) {
    const id = newTileId();
    const tile: NoteTile = { id, kind: 'note', pitch, bass: false, cell: null };
    registry.set(id, tile);
    order.push(id);
  }

  return { order, registry, tray: [], discardedCount: 0 };
}

/**
 * Draw tiles from the top of the deck until the tray reaches `capacity`
 * (or the deck is empty). Returns a new DeckRecord.
 */
export function drawTo(record: DeckRecord, capacity: number): DeckRecord {
  const needed = capacity - record.tray.length;
  if (needed <= 0) return record;

  const newOrder = [...record.order];
  const newTray = [...record.tray];

  const toDraw = Math.min(needed, newOrder.length);
  for (let i = 0; i < toDraw; i++) {
    newTray.push(newOrder.shift()!);
  }

  return { ...record, order: newOrder, tray: newTray };
}

/**
 * Return a tile from the canvas/tray back to the bottom of the deck.
 * (The tile stays in the registry; its cell should be set to null by caller.)
 */
export function returnToDeck(record: DeckRecord, id: TileId): DeckRecord {
  const newTray = record.tray.filter(t => t !== id);
  const newOrder = [...record.order, id];
  return { ...record, tray: newTray, order: newOrder };
}

/**
 * Permanently discard a tile from the tray.
 * Removes it from the registry and increments discardedCount.
 */
export function discardFromTray(record: DeckRecord, id: TileId): DeckRecord {
  const newTray = record.tray.filter(t => t !== id);
  const newRegistry = new Map(record.registry);
  newRegistry.delete(id);
  return { ...record, tray: newTray, registry: newRegistry, discardedCount: record.discardedCount + 1 };
}
