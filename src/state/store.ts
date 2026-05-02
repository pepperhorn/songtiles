import { create } from 'zustand';
import type { Cell, Tile, TileId, SegmentSettings, TrayCapacity, RepeatPoolSize } from '../graph/types';
import { cellKey } from '../graph/types';
import { createDeck, drawTo, returnToDeck, discardFromTray, type DeckRecord } from './deck';
import { isAdjacentToGraph, isEndpoint, wouldDisconnect } from '../graph/adjacency';
import { createAudioEngine } from '../audio/engine';
import { createSongtilesPlayer, type SongtilesPlayer } from '../audio/songtilesPlayer';
import { createScheduler } from '../playback/scheduler';
import { computeSegments } from '../graph/segments';

// ---------------------------------------------------------------------------
// Module-level singletons — survive React re-renders, not part of renderable state
// ---------------------------------------------------------------------------
let _player: SongtilesPlayer | null = null;
let _scheduler: ReturnType<typeof createScheduler> | null = null;

function ensurePlayer(): SongtilesPlayer {
  if (_player) return _player;
  _player = createSongtilesPlayer(createAudioEngine());
  return _player;
}

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
  play(): void;
  stop(): void;
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
    if (!s.tiles[id] || s.byCell[cellKey(cell)]) return;
    if (!isAdjacentToGraph(cell, s.tiles, s.byCell)) return; // must touch existing graph
    const tile = s.tiles[id];
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
    if (wouldDisconnect(id, s.tiles, s.byCell)) return; // block: not an endpoint

    const key = cellKey(tile.cell);
    const { [key]: _gone, ...byCell } = s.byCell;
    void _gone;

    // Build the post-removal tile state for endpoint scanning.
    const updatedTiles = { ...s.tiles, [id]: { ...tile, cell: null } };

    let startTileId = s.startTileId;
    if (startTileId === id) {
      // Fallback: lowest (y, x) endpoint among remaining placed tiles.
      const remaining = Object.values(updatedTiles).filter(t => t.cell);
      const candidates = remaining
        .filter(t => isEndpoint(t.id, updatedTiles, byCell))
        .sort((a, b) => (a.cell!.y - b.cell!.y) || (a.cell!.x - b.cell!.x));
      startTileId = candidates[0]?.id ?? null;
    }

    set({
      tiles: updatedTiles,
      byCell,
      tray: [...s.tray, id],
      startTileId,
    });
  },

  setStartTile(id) { set({ startTileId: id }); },

  play() {
    const s = get();
    if (!s.startTileId) return;
    const player = ensurePlayer();
    // Best-effort: load the patch on first play (no-op if already loaded).
    player.setPatch(s.patchId).catch(() => {});
    _scheduler?.stop();
    _scheduler = createScheduler({
      now: () => player.now(),
      emit: ev => player.playNote({ midi: ev.midi, when: ev.when, duration: ev.duration, velocity: ev.velocity }),
      getSnapshot: () => {
        const st = get();
        return {
          segments: st.startTileId ? computeSegments(st.startTileId, st.tiles, st.byCell) : [],
          segmentSettings: st.segmentSettings,
          tiles: st.tiles,
          bpm: st.bpm,
        };
      },
    });
    _scheduler.start();
    set({ isPlaying: true });
  },

  stop() {
    _scheduler?.stop();
    _scheduler = null;
    _player?.stopAll();
    set({ isPlaying: false });
  },
}));
