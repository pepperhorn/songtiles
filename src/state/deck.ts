import type { Tile, TileId, GameMode, Wildness } from '../graph/types';
import { getGameMode } from '../games/registry';

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

export interface CreateDeckOptions {
  mode: GameMode;
  wildness: Wildness;
  /** Mode-specific params, shape defined by the registered GameMode. */
  params: unknown;
  rng?: Rng;
}

/** Build a shuffled deck by dispatching to the registered GameMode. */
export function createDeck(opts: CreateDeckOptions): DeckRecord {
  const mode = getGameMode(opts.mode);
  if (!mode) throw new Error(`Unknown game mode "${opts.mode}"`);
  return mode.buildDeck({ wildness: opts.wildness, params: opts.params, rng: opts.rng });
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
