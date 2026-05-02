import { create } from 'zustand';
import type { Cell, Tile, TileId, SegmentSettings, SegmentMode, TrayCapacity, RepeatPoolSize } from '../graph/types';
import { cellKey } from '../graph/types';
import { serialiseSession, deserialiseSession } from './persistence';
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

  // Selected tile (for detail panel)
  selectedTileId: TileId | null;

  // Actions
  initSession(opts: { trayCapacity: TrayCapacity; repeatPoolSize: RepeatPoolSize }): void;
  refillTray(): void;
  discardTrayTile(id: TileId): void;
  placeTileOnCell(id: TileId, cell: Cell): void;
  returnTileFromCanvas(id: TileId): void;
  setStartTile(id: TileId | null): void;
  selectTile(id: TileId | null): void;
  setSegmentMode(rootId: TileId, mode: SegmentMode): void;
  setSegmentHold(rootId: TileId, holdBeats: 1|2|3|4): void;
  toggleBass(id: TileId): void;
  cycleRepeatCount(id: TileId): void;
  play(): void;
  stop(): void;
  previewNote(midi: number): void;
  initAudio(): void;
  setBpm(bpm: number): void;
  saveToFile(): void;
  loadFromFile(file: File): Promise<void>;
}

const baseDefaults = {
  tiles: {} as Record<TileId, Tile>,
  byCell: {} as Record<string, TileId>,
  startTileId: null as TileId | null,
  selectedTileId: null as TileId | null,
  segmentSettings: {} as Record<TileId, SegmentSettings>,
  tray: [] as TileId[],
  deck: [] as TileId[],
  discardedCount: 0,
  trayCapacity: 8 as TrayCapacity,
  repeatPoolSize: 5 as RepeatPoolSize,
  repeatSetsRemaining: 5,
  bpm: 120,
  patchId: 'acoustic_grand_piano',
  isPlaying: false,
};

// Adapter: pull DeckRecord-shaped fields out of an AppState slice (note tiles only).
function deckSlice(s: Pick<AppState, 'tiles'|'tray'|'deck'|'discardedCount'>): DeckRecord {
  const tiles: Record<string, Tile> = {};
  for (const id of [...s.deck, ...s.tray]) {
    const t = s.tiles[id];
    if (t) tiles[id] = t;
  }
  return {
    tiles,
    deck: s.deck,
    tray: s.tray,
    discardedCount: s.discardedCount,
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  ...baseDefaults,

  initSession({ trayCapacity, repeatPoolSize }) {
    // Repeat wildcards live in the deck and are drawn to the tray like notes.
    const d = drawTo(createDeck(repeatPoolSize), trayCapacity);
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

  selectTile(id) { set({ selectedTileId: id }); },

  toggleBass(id) {
    const s = get();
    const t = s.tiles[id];
    if (!t || t.kind !== 'note') return;
    set({ tiles: { ...s.tiles, [id]: { ...t, bass: !t.bass } } });
  },

  setSegmentMode(rootId, mode) {
    const s = get();
    const prior = s.segmentSettings[rootId] ?? { segmentRootId: rootId, mode: 'sequential' as const, holdBeats: 1 as const };
    set({ segmentSettings: { ...s.segmentSettings, [rootId]: { ...prior, segmentRootId: rootId, mode } } });
  },

  setSegmentHold(rootId, holdBeats) {
    const s = get();
    const prior = s.segmentSettings[rootId] ?? { segmentRootId: rootId, mode: 'sequential' as const, holdBeats: 1 as const };
    set({ segmentSettings: { ...s.segmentSettings, [rootId]: { ...prior, segmentRootId: rootId, holdBeats } } });
  },

  cycleRepeatCount(id) {
    const s = get();
    const t = s.tiles[id];
    if (!t || t.kind !== 'repeat-open') return;
    const order: Array<1|2|3|4|'inf'> = [1,2,3,4,'inf',1];
    const next = order[order.indexOf(t.count) + 1];
    set({ tiles: { ...s.tiles, [id]: { ...t, count: next } } });
  },

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

  previewNote(midi) {
    if (!Number.isFinite(midi)) return;
    if (typeof AudioContext === 'undefined') return; // jsdom / SSR
    try {
      const player = ensurePlayer();
      player.setPatch(get().patchId).catch(() => {});
      // Drop silently if the patch isn't loaded yet (engine short-circuits).
      // Preview length scales with current bpm so a touch matches one beat at tempo.
      const beatSec = 60 / get().bpm;
      player.playNote({ midi, when: player.now(), duration: beatSec, velocity: 0.8 });
    } catch {
      // Audio init can fail (autoplay policy, no user gesture, etc.) — never crash the UI.
    }
  },

  setBpm(bpm) {
    const clamped = Math.round(Math.min(240, Math.max(30, bpm)));
    if (clamped !== get().bpm) set({ bpm: clamped });
  },

  initAudio() {
    if (typeof AudioContext === 'undefined') return;
    try {
      const player = ensurePlayer();
      // Force AudioContext construction *synchronously* inside this user gesture
      // (player.now() touches engine.getAudioContext()). Without this the context
      // is constructed later inside the async setPatch chain, and iOS/Safari
      // refuses to unlock it.
      player.now();
      // Kick off the soundfont download — first tile preview will be instant.
      player.setPatch(get().patchId).catch(() => {});
    } catch { /* never crash UI */ }
  },

  saveToFile() {
    const s = get();
    const json = serialiseSession(s);
    // Guard: avoid running in environments without Blob/createObjectURL (e.g. tests).
    if (typeof Blob === 'undefined' || typeof URL.createObjectURL === 'undefined') return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
    a.href = url; a.download = `songtiles-${stamp}.json`; a.click();
    URL.revokeObjectURL(url);
  },

  async loadFromFile(file: File) {
    const txt = await file.text();
    const f = deserialiseSession(JSON.parse(txt));
    set({
      tiles: f.tiles, byCell: f.byCell,
      startTileId: f.startTileId, segmentSettings: f.segmentSettings,
      tray: f.placements.tray, deck: f.placements.deck, discardedCount: f.discardedCount,
      trayCapacity: f.trayCapacity, repeatPoolSize: f.repeatPoolSize,
      repeatSetsRemaining: f.repeatSetsRemaining,
      bpm: f.bpm, patchId: f.patchId, isPlaying: false,
    });
  },
}));

// LocalStorage autosave — runs on every store mutation in browser environments.
if (typeof window !== 'undefined') {
  useAppStore.subscribe(state => {
    try { localStorage.setItem('songtiles.autosave', serialiseSession(state)); } catch {}
  });
}
