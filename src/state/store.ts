import { create } from 'zustand';
import type { Cell, Tile, TileId, SegmentSettings, SegmentMode, TrayCapacity, Wildness, GameMode, ScaleRoot, ScaleType, Paint, PaintId, PaintTool, PaintKind } from '../graph/types';
import { cellKey } from '../graph/types';
import { newTileId } from '../utils/id';
import { serialiseSession, deserialiseSession } from './persistence';
import { createDeck, drawTo, returnToDeck, discardFromTray, type DeckRecord } from './deck';
import { isAdjacentToGraph, isEndpoint, wouldDisconnect } from '../graph/adjacency';
import { createAudioEngine } from '../audio/engine';
import { createSongtilesPlayer, type SongtilesPlayer } from '../audio/songtilesPlayer';
import { createScheduler } from '../playback/scheduler';
import { recordToFile } from '../audio/recorder';
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
  wildness: Wildness;
  gameMode: GameMode;
  scaleRoot: ScaleRoot;
  scaleType: ScaleType;
  bpm: number;
  patchId: string;
  isPlaying: boolean;
  audioReady: boolean;

  // Selected tile (for detail panel)
  selectedTileId: TileId | null;

  // Paint mode: selecting tiles to form chords / arps / erase paints.
  paints: Record<PaintId, Paint>;
  paintTool: PaintTool;
  paintingTileIds: TileId[];

  // Currently sounding tiles (for the live playhead halo).
  activeTiles: Record<TileId, true>;

  // Actions
  initSession(opts: {
    trayCapacity: TrayCapacity;
    wildness: Wildness;
    gameMode: GameMode;
    scaleRoot?: ScaleRoot;
    scaleType?: ScaleType;
  }): void;
  refillTray(): void;
  discardTrayTile(id: TileId): void;
  placeTileOnCell(id: TileId, cell: Cell): void;
  moveTileOnCanvas(id: TileId, cell: Cell): boolean;
  returnTileFromCanvas(id: TileId): void;
  setStartTile(id: TileId | null): void;
  selectTile(id: TileId | null): void;
  setSegmentMode(rootId: TileId, mode: SegmentMode): void;
  setSegmentHold(rootId: TileId, holdBeats: 1|2|3|4): void;
  toggleBass(id: TileId): void;
  cycleRepeatCount(id: TileId): void;
  play(): void;
  stop(): void;
  recordSong(): Promise<void>;
  previewNote(midi: number, bass?: boolean): void;
  initAudio(): void;
  setBpm(bpm: number): void;
  saveToFile(): void;
  loadFromFile(file: File): Promise<void>;

  setPaintTool(tool: PaintTool): void;
  togglePaintMembership(id: TileId): void;
  commitPaint(): void;
  removeTileFromAllPaints(id: TileId): void;
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
  wildness: 'wild' as Wildness,
  gameMode: 'explorer' as GameMode,
  scaleRoot: 0 as ScaleRoot,
  scaleType: 'major' as ScaleType,
  bpm: 240,
  patchId: 'acoustic_grand_piano',
  isPlaying: false,
  audioReady: false,
  paints: {} as Record<PaintId, Paint>,
  paintTool: null as PaintTool,
  paintingTileIds: [] as TileId[],
  activeTiles: {} as Record<TileId, true>,
};

// Active-tile timer registry — clear on stop so we don't leak across sessions.
const _activeTimers: Set<ReturnType<typeof setTimeout>> = new Set();
function _clearActiveTimers() {
  for (const t of _activeTimers) clearTimeout(t);
  _activeTimers.clear();
}

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

  initSession({ trayCapacity, wildness, gameMode, scaleRoot, scaleType }) {
    const d = drawTo(
      createDeck({
        mode: gameMode,
        wildness,
        scaleRoot: scaleRoot ?? 0,
        scaleType: scaleType ?? 'major',
      }),
      trayCapacity,
    );
    set({
      ...baseDefaults,
      tiles: d.tiles, tray: d.tray, deck: d.deck, discardedCount: d.discardedCount,
      trayCapacity, wildness, gameMode,
      scaleRoot: scaleRoot ?? 0,
      scaleType: scaleType ?? 'major',
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
      // Auto-pick start tile, but never a repeat marker — only note tiles
      // are valid playback origins.
      startTileId: s.startTileId ?? (tile.kind === 'note' ? id : null),
    });
  },

  moveTileOnCanvas(id, cell) {
    const s = get();
    const tile = s.tiles[id];
    if (!tile?.cell) return false;
    const oldKey = cellKey(tile.cell);
    const newKey = cellKey(cell);
    if (oldKey === newKey) return false;
    if (s.byCell[newKey]) return false; // occupied

    // Build the virtual byCell with tile moved.
    const { [oldKey]: _gone, ...byCellMid } = s.byCell;
    void _gone;
    const tilesMid = { ...s.tiles, [id]: { ...tile, cell } };
    const byCellNext = { ...byCellMid, [newKey]: id };

    // Validate: new cell must be orthogonally adjacent to ANOTHER placed tile,
    // and the resulting graph must be fully connected.
    const placedIds = Object.keys(tilesMid).filter(tid => tilesMid[tid].cell);
    if (placedIds.length > 1) {
      // Adjacency to graph (excluding self).
      const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
      let touchesGraph = false;
      for (const d of dirs) {
        const k = cellKey({ x: cell.x + d.x, y: cell.y + d.y });
        const nbrId = byCellNext[k];
        if (nbrId && nbrId !== id) { touchesGraph = true; break; }
      }
      if (!touchesGraph) return false;

      // Connectivity BFS.
      const start = placedIds[0];
      const visited = new Set<TileId>([start]);
      const queue = [start];
      while (queue.length) {
        const cur = queue.shift()!;
        const t = tilesMid[cur];
        if (!t.cell) continue;
        for (const d of dirs) {
          const nk = cellKey({ x: t.cell.x + d.x, y: t.cell.y + d.y });
          const nbr = byCellNext[nk];
          if (nbr && !visited.has(nbr)) {
            visited.add(nbr);
            queue.push(nbr);
          }
        }
      }
      if (visited.size !== placedIds.length) return false;
    }

    // Strip from any paints (delete paint if it falls below 2 tiles).
    const nextPaints: Record<PaintId, Paint> = {};
    for (const [pid, p] of Object.entries(s.paints)) {
      if (!p.tileIds.includes(id)) { nextPaints[pid] = p; continue; }
      const remaining = p.tileIds.filter(t => t !== id);
      if (remaining.length >= 2) nextPaints[pid] = { ...p, tileIds: remaining };
    }

    set({
      tiles: tilesMid,
      byCell: byCellNext,
      paints: nextPaints,
    });
    return true;
  },

  returnTileFromCanvas(id) {
    const s = get();
    const tile = s.tiles[id];
    if (!tile?.cell) return;
    if (wouldDisconnect(id, s.tiles, s.byCell)) return; // block: not an endpoint

    const key = cellKey(tile.cell);
    const { [key]: _gone, ...byCell } = s.byCell;
    void _gone;

    // Endpoint scanning needs the post-removal byCell shape.
    let startTileId = s.startTileId;
    if (startTileId === id) {
      const remaining = Object.values(s.tiles).filter(t => t.cell && t.id !== id);
      const candidates = remaining
        .filter(t => t.kind === 'note' && isEndpoint(t.id, s.tiles, byCell))
        .sort((a, b) => (a.cell!.y - b.cell!.y) || (a.cell!.x - b.cell!.x));
      startTileId = candidates[0]?.id ?? null;
    }

    if (s.tray.length >= s.trayCapacity) {
      // Tray is full → discard the tile entirely (drop from registry, count as discarded).
      const { [id]: _dropped, ...tiles } = s.tiles;
      void _dropped;
      set({
        tiles,
        byCell,
        startTileId,
        discardedCount: s.discardedCount + 1,
      });
    } else {
      // Return to tray.
      set({
        tiles: { ...s.tiles, [id]: { ...tile, cell: null } },
        byCell,
        tray: [...s.tray, id],
        startTileId,
      });
    }
  },

  setStartTile(id) { set({ startTileId: id }); },

  selectTile(id) { set({ selectedTileId: id }); },

  toggleBass(id) {
    const s = get();
    const t = s.tiles[id];
    if (!t || t.kind !== 'note') return;
    const nextBass = !t.bass;
    set({ tiles: { ...s.tiles, [id]: { ...t, bass: nextBass } } });
    // Preview the new state so the user hears whether bass is now on/off.
    get().previewNote(t.pitch, nextBass);
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
    if (!t || t.kind !== 'repeat') return;
    const order: Array<1|2|3|4|'inf'> = [1,2,3,4,'inf',1];
    const next = order[order.indexOf(t.count) + 1];
    set({ tiles: { ...s.tiles, [id]: { ...t, count: next } } });
  },

  play() {
    const s = get();
    if (!s.startTileId) return;
    // Defensive: drop any active paint tool so its swipe handler can't
    // intercept tile taps during playback.
    if (s.paintTool || s.paintingTileIds.length) {
      set({ paintTool: null, paintingTileIds: [] });
    }
    const player = ensurePlayer();
    // Best-effort: load the patch on first play (no-op if already loaded).
    player.setPatch(s.patchId).catch(() => {});
    _scheduler?.stop();
    _clearActiveTimers();
    set({ activeTiles: {} });
    _scheduler = createScheduler({
      now: () => player.now(),
      emit: ev => {
        player.playNote({ midi: ev.midi, when: ev.when, duration: ev.duration, velocity: ev.velocity });
        // Schedule UI playhead flashes — convert audio-time delay to wall-clock ms.
        if (ev.tileId) {
          const tileId = ev.tileId;
          const onMs = Math.max(0, (ev.when - player.now()) * 1000);
          const offMs = Math.max(onMs + 30, (ev.when + ev.duration - player.now()) * 1000);
          const onT = setTimeout(() => {
            _activeTimers.delete(onT);
            const cur = get().activeTiles;
            if (!cur[tileId]) set({ activeTiles: { ...cur, [tileId]: true } });
          }, onMs);
          _activeTimers.add(onT);
          const offT = setTimeout(() => {
            _activeTimers.delete(offT);
            const cur = get().activeTiles;
            if (cur[tileId]) {
              const { [tileId]: _, ...rest } = cur;
              set({ activeTiles: rest });
            }
          }, offMs);
          _activeTimers.add(offT);
        }
      },
      getSnapshot: () => {
        const st = get();
        return {
          segments: st.startTileId ? computeSegments(st.startTileId, st.tiles, st.byCell) : [],
          tiles: st.tiles,
          paints: st.paints,
          bpm: st.bpm,
        };
      },
      onEnd: () => {
        // Auto-stop: playback ran past the last scheduled event.
        _scheduler?.stop();
        _scheduler = null;
        set({ isPlaying: false });
        // Defer activeTiles clear until after the last off-timer fires.
      },
    });
    _scheduler.start();
    set({ isPlaying: true });
  },

  stop() {
    _scheduler?.stop();
    _scheduler = null;
    _player?.stopAll();
    _clearActiveTimers();
    set({ isPlaying: false, activeTiles: {} });
  },

  async recordSong() {
    const s = get();
    if (!s.startTileId) throw new Error('Pick a start tile first.');
    const player = ensurePlayer();
    // Awaits a natural playback end via an isPlaying subscription.
    const runPlayback = () => new Promise<void>(resolve => {
      const unsub = useAppStore.subscribe(state => {
        if (!state.isPlaying) {
          unsub();
          resolve();
        }
      });
      get().play();
    });
    await recordToFile({
      audioContext: player.engine.getAudioContext(),
      masterNode: player.engine.getMasterNode(),
      runPlayback,
      maxDurationMs: 60_000,
      filenameStem: 'doremino',
    });
  },

  previewNote(midi, bass) {
    if (!Number.isFinite(midi)) return;
    if (typeof AudioContext === 'undefined') return; // jsdom / SSR
    try {
      const player = ensurePlayer();
      player.setPatch(get().patchId).catch(() => {});
      // Drop silently if the patch isn't loaded yet (engine short-circuits).
      // Preview length scales with current bpm so a touch matches one beat at tempo.
      const beatSec = 60 / get().bpm;
      const when = player.now();
      player.playNote({ midi, when, duration: beatSec, velocity: 0.8 });
      if (bass) {
        // Mirror playhead bass: clamp to C2..B2 (midi 36 + pitch class).
        const pc = ((midi % 12) + 12) % 12;
        player.playNote({ midi: 36 + pc, when, duration: beatSec, velocity: 0.8 });
      }
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
      set({ audioReady: true });
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
    a.href = url; a.download = `doremino-${stamp}.json`; a.click();
    URL.revokeObjectURL(url);
  },

  async loadFromFile(file: File) {
    const txt = await file.text();
    const f = deserialiseSession(JSON.parse(txt));
    set({
      tiles: f.tiles, byCell: f.byCell,
      startTileId: f.startTileId, segmentSettings: f.segmentSettings,
      tray: f.placements.tray, deck: f.placements.deck, discardedCount: f.discardedCount,
      trayCapacity: f.trayCapacity, wildness: f.wildness,
      gameMode: f.gameMode, scaleRoot: f.scaleRoot, scaleType: f.scaleType,
      bpm: f.bpm, patchId: f.patchId, isPlaying: false,
    });
  },

  // Paints ------------------------------------------------------------------

  setPaintTool(tool) {
    const s = get();
    // Switching tools auto-commits any in-progress paint.
    if ((s.paintTool === 'chord' || s.paintTool === 'arp') && s.paintingTileIds.length >= 2) {
      commitInProgressPaint(set, get, s.paintTool);
    } else if (s.paintingTileIds.length > 0) {
      set({ paintingTileIds: [] });
    }
    set({ paintTool: tool });
  },

  togglePaintMembership(id) {
    const s = get();
    const tile = s.tiles[id];
    if (!tile?.cell || tile.kind !== 'note') return;       // only placed note tiles
    if (s.paintTool === 'eraser') {
      get().removeTileFromAllPaints(id);
      return;
    }
    if (s.paintTool !== 'chord' && s.paintTool !== 'arp') return;
    const next = s.paintingTileIds.includes(id)
      ? s.paintingTileIds.filter(t => t !== id)
      : [...s.paintingTileIds, id];
    set({ paintingTileIds: next });
  },

  commitPaint() {
    const s = get();
    if (s.paintTool !== 'chord' && s.paintTool !== 'arp') return;
    if (s.paintingTileIds.length < 2) {
      set({ paintingTileIds: [] });
      return;
    }
    commitInProgressPaint(set, get, s.paintTool);
  },

  removeTileFromAllPaints(id) {
    const s = get();
    const next: Record<PaintId, Paint> = {};
    for (const [pid, p] of Object.entries(s.paints)) {
      const remaining = p.tileIds.filter(t => t !== id);
      if (remaining.length >= 2) next[pid] = { ...p, tileIds: remaining };
      // else: drop the paint entirely (fewer than 2 tiles left).
    }
    set({ paints: next });
  },
}));

function commitInProgressPaint(
  set: (partial: Partial<AppState>) => void,
  get: () => AppState,
  kind: PaintKind,
) {
  const s = get();
  const ids = s.paintingTileIds.slice();
  if (ids.length < 2) {
    set({ paintingTileIds: [] });
    return;
  }
  const id = `paint_${newTileId()}`;
  const paint: Paint = { id, kind, tileIds: ids };
  set({
    paints: { ...s.paints, [id]: paint },
    paintingTileIds: [],
  });
}

// LocalStorage autosave — runs on every store mutation in browser environments.
if (typeof window !== 'undefined') {
  useAppStore.subscribe(state => {
    try { localStorage.setItem('doremino.autosave', serialiseSession(state)); } catch {}
  });
}
