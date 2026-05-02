import { useEffect, useRef, useState } from 'react';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';
import { useAppStore } from './state/store';
import { deserialiseSession } from './state/persistence';
import { Canvas } from './components/Canvas';
import { Tray } from './components/Tray';
import { DetailPanel } from './components/DetailPanel';
import { RepeatPocket } from './components/RepeatPocket';
import { SetupModal } from './components/SetupModal';

function Inner() {
  const { tokens } = useTheme();
  const initSession = useAppStore(s => s.initSession);
  const isPlaying = useAppStore(s => s.isPlaying);
  const play = useAppStore(s => s.play);
  const stop = useAppStore(s => s.stop);
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
      <RepeatPocket />

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
