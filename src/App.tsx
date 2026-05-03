import { useEffect, useRef, useState } from 'react';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';
import { useAppStore } from './state/store';
import { deserialiseSession } from './state/persistence';
import { Canvas } from './components/Canvas';
import { Tray } from './components/Tray';
import { DetailPanel } from './components/DetailPanel';
import { SetupModal } from './components/SetupModal';
import { SoundPicker } from './components/SoundPicker';
import { PaintToolbar } from './components/PaintToolbar';

function Inner() {
  const { tokens, mode, setMode } = useTheme();
  const initSession = useAppStore(s => s.initSession);
  const isPlaying = useAppStore(s => s.isPlaying);
  const play = useAppStore(s => s.play);
  const stop = useAppStore(s => s.stop);
  const bpm = useAppStore(s => s.bpm);
  const setBpm = useAppStore(s => s.setBpm);
  const saveToFile = useAppStore(s => s.saveToFile);
  const loadFromFile = useAppStore(s => s.loadFromFile);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine initial showSetup: show modal only if no autosave AND no firstRunDone flag.
  const [showSetup, setShowSetup] = useState<boolean>(() => {
    try {
      const hasAutosave = !!localStorage.getItem('songtiles.autosave');
      const firstRunDone = localStorage.getItem('songtiles.firstRunDone') === 'yes';
      return !hasAutosave && !firstRunDone;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (showSetup) return;
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('songtiles.autosave') : null;
      if (raw) {
        const f = deserialiseSession(JSON.parse(raw));
        useAppStore.setState({
          tiles: f.tiles, byCell: f.byCell,
          startTileId: f.startTileId, segmentSettings: f.segmentSettings,
          tray: f.placements.tray, deck: f.placements.deck, discardedCount: f.discardedCount,
          trayCapacity: f.trayCapacity, repeatPoolSize: f.repeatPoolSize,
          repeatSetsRemaining: f.repeatSetsRemaining,
          bpm: f.bpm, patchId: f.patchId, isPlaying: false,
        });
        return;
      }
    } catch {}
    initSession({ trayCapacity: 8, repeatPoolSize: 5 });
  }, [initSession, showSetup]);

  function newGame() {
    if (!confirm('Start a new game? Your current canvas will be lost.')) return;
    stop();
    try {
      localStorage.removeItem('songtiles.autosave');
      localStorage.removeItem('songtiles.firstRunDone');
    } catch {}
    setShowSetup(true);
  }

  const btnStyle = {
    background: tokens.topBarBg,
    color: tokens.textPrimary,
    boxShadow: tokens.tileShadow,
  } as const;

  return (
    <div className="app-root min-h-screen" style={{ background: tokens.canvasBg, color: tokens.textPrimary }}>
      {showSetup && <SetupModal onComplete={() => setShowSetup(false)} />}
      <Canvas />
      <DetailPanel />
      <Tray />

      <div
        className="top-bar fixed top-3 left-3 right-3 flex flex-wrap items-center justify-end gap-2 z-10"
        style={{ pointerEvents: 'none' }}
      >
        <button
          className="new-game-btn px-3 py-2 rounded-full font-medium text-sm"
          style={{ ...btnStyle, pointerEvents: 'auto' }}
          onClick={newGame}
          aria-label="new game"
        >
          New
        </button>
        <button
          className="save-btn px-3 py-2 rounded-full font-medium text-sm"
          style={{ ...btnStyle, pointerEvents: 'auto' }}
          onClick={() => saveToFile()}
        >
          Save
        </button>
        <button
          className="load-btn px-3 py-2 rounded-full font-medium text-sm"
          style={{ ...btnStyle, pointerEvents: 'auto' }}
          onClick={() => fileInputRef.current?.click()}
        >
          Load
        </button>
        <div
          className="bpm-control flex items-center gap-1 rounded-full px-2 py-1"
          style={{ ...btnStyle, pointerEvents: 'auto' }}
        >
          <button
            className="bpm-down w-9 h-9 rounded-full font-semibold text-base grid place-items-center"
            style={{ background: tokens.canvasBg, color: tokens.textPrimary }}
            aria-label="bpm down"
            onClick={() => setBpm(bpm - 4)}
          >
            −
          </button>
          <span className="bpm-value tabular-nums text-sm font-medium px-1" style={{ minWidth: 64, textAlign: 'center' }}>
            {bpm} bpm
          </span>
          <button
            className="bpm-up w-9 h-9 rounded-full font-semibold text-base grid place-items-center"
            style={{ background: tokens.canvasBg, color: tokens.textPrimary }}
            aria-label="bpm up"
            onClick={() => setBpm(bpm + 4)}
          >
            +
          </button>
        </div>
        <PaintToolbar />
        <SoundPicker />
        <button
          className="theme-toggle px-3 py-2 rounded-full font-medium text-sm grid place-items-center"
          style={{ ...btnStyle, pointerEvents: 'auto' }}
          onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          aria-label={mode === 'dark' ? 'switch to light theme' : 'switch to dark theme'}
          title={mode === 'dark' ? 'Light' : 'Dark'}
        >
          <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>
            {mode === 'dark' ? '☀' : '☾'}
          </span>
        </button>
        <button
          className="play-stop px-4 py-2 rounded-full font-semibold text-sm"
          style={{ ...btnStyle, pointerEvents: 'auto' }}
          onClick={() => isPlaying ? stop() : play()}
        >
          {isPlaying ? 'Stop' : 'Play'}
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) loadFromFile(f).catch((err: Error) => alert('Load failed: ' + err.message));
          e.target.value = '';
        }}
      />
    </div>
  );
}

export default function App() {
  return <ThemeProvider><Inner /></ThemeProvider>;
}
