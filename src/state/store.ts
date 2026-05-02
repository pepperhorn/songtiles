import { create } from 'zustand';
import type { Cell, Tile, TileId, SegmentSettings, TrayCapacity, RepeatPoolSize } from '../graph/types';
import { cellKey } from '../graph/types';
import { createDeck, drawTo, returnToDeck, discardFromTray, type DeckRecord } from './deck';

export interface AppState {
  // All tiles known to the session, keyed by id (canvas + tray + deck).
  tiles: Record<TileId, Tile>;
  // "x,y" → tile id, for adjacency lookup.
  byCell: Record<string, TileId>;
  // Halo'd start tile (auto-set to the first placed tile).
  startTileId: TileId | null;
  // Per-segment settings keyed by segment-root tile id (filled in M11).
  segmentSettings: Record<TileId, SegmentSettings>;
  // Tray + deck + discard accounting.
  tray: TileId[];
  deck: TileId[];
  discardedCount: number;
  // Session config / playback state.
  trayCapacity: TrayCapacity;
  repeatPoolSize: RepeatPoolSize;
  repeatSetsRemaining: number;
  bpm: number;
  patchId: string;
  isPlaying: boolean;

  // Actions
  initSession(opts: { trayCapacity: TrayCapacity; repeatPoolSize: RepeatPoolSize }): void;
  refillTray(): void;
  discardTrayTile(id: TileId): void;
  placeTileOnCell(id: TileId, cell: Cell): void;
  returnTileFromCanvas(id: TileId): void;
  setStartTile(id: TileId | null): void;
}

const baseDefaults = {
  tiles: {} as Record<TileId, Tile>,
  byCell: {} as Record<string, TileId>,
  startTileId: null as TileId | null,
  segmentSettings: {} as Record<TileId, SegmentSettings>,
  tray: [] as TileId[],
  deck: [] as TileId[],
  discardedCount: 0,
  trayCapacity: 8 as TrayCapacity,
  repeatPoolSize: 5 as RepeatPoolSize,
  repeatSetsRemaining: 5,
  bpm: 96,
  patchId: 'acoustic_grand_piano',
  isPlaying: false,
};

// Adapter: pull DeckRecord-shaped fields out of an AppState slice (note tiles only).
function deckSlice(s: Pick<AppState, 'tiles'|'tray'|'deck'|'discardedCount'>): DeckRecord {
  const noteTiles: Record<string, never> = {};
  for (const id of [...s.deck, ...s.tray]) {
    const t = s.tiles[id];
    if (t && t.kind === 'note') (noteTiles as Record<string, Tile>)[id] = t;
  }
  return {
    tiles: noteTiles as DeckRecord['tiles'],
    deck: s.deck,
    tray: s.tray,
    discardedCount: s.discardedCount,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  ...baseDefaults,

  initSession({ trayCapacity, repeatPoolSize }) {
    const d = drawTo(createDeck(), trayCapacity);
    set({
      ...baseDefaults,
      tiles: d.tiles, tray: d.tray, deck: d.deck, discardedCount: d.discardedCount,
      trayCapacity, repeatPoolSize, repeatSetsRemaining: repeatPoolSize,
      bpm: get().bpm, patchId: get().patchId,
    });
  },

  refillTray() {
    const s = get();
    const d = drawTo(deckSlice(s), s.trayCapacity);
    // Merge new note tiles back into the full tile registry (preserves repeat tiles).
    set({ tiles: { ...s.tiles, ...d.tiles }, tray: d.tray, deck: d.deck });
  },

  discardTrayTile(id) {
    const s = get();
    const d = discardFromTray(deckSlice(s), id);
    const { [id]: _gone, ...remaining } = s.tiles;
    void _gone;
    set({ tiles: remaining, tray: d.tray, deck: d.deck, discardedCount: d.discardedCount });
  },

  placeTileOnCell(id, cell) {
    const s = get();
    const tile = s.tiles[id];
    if (!tile) return;
    if (s.byCell[cellKey(cell)]) return; // cell occupied
    set({
      tiles: { ...s.tiles, [id]: { ...tile, cell } },
      tray: s.tray.filter(x => x !== id),
      byCell: { ...s.byCell, [cellKey(cell)]: id },
      startTileId: s.startTileId ?? id,
    });
  },

  returnTileFromCanvas(id) {
    const s = get();
    const tile = s.tiles[id];
    if (!tile?.cell) return;
    const key = cellKey(tile.cell);
    const { [key]: _gone, ...byCell } = s.byCell;
    void _gone;
    set({
      tiles: { ...s.tiles, [id]: { ...tile, cell: null } },
      byCell,
      tray: [...s.tray, id],
      startTileId: s.startTileId === id ? null : s.startTileId,
    });
  },

  setStartTile(id) { set({ startTileId: id }); },
}));
