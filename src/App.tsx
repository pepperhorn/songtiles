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
    // If the modal is showing, let it handle initSession when the user presses Start.
    if (showSetup) return;

    // Try restoring autosave; fall back to a fresh session.
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

    // Edge case: firstRunDone is set but no autosave exists (e.g. after a manual reset).
    // Start a fresh session without showing the modal.
    initSession({ trayCapacity: 8, repeatPoolSize: 5 });
  }, [initSession, showSetup]);

  return (
    <div className="app-root min-h-screen" style={{ background: tokens.canvasBg, color: tokens.textPrimary }}>
      {showSetup && <SetupModal onComplete={() => setShowSetup(false)} />}
      <Canvas />
      <DetailPanel />
      <Tray />
      <RepeatPocket />
      <button
        className="play-stop fixed top-4 right-4 px-4 py-2 rounded-full font-medium z-10"
        style={{ background: tokens.topBarBg, color: tokens.textPrimary, boxShadow: tokens.tileShadow }}
        onClick={() => isPlaying ? stop() : play()}
      >
        {isPlaying ? 'Stop' : 'Play'}
      </button>
      <button
        className="save-btn fixed top-4 right-[400px] px-3 py-2 rounded-full font-medium z-10"
        style={{ background: tokens.topBarBg, color: tokens.textPrimary, boxShadow: tokens.tileShadow }}
        onClick={() => saveToFile()}
      >
        Save
      </button>
      <button
        className="load-btn fixed top-4 right-[336px] px-3 py-2 rounded-full font-medium z-10"
        style={{ background: tokens.topBarBg, color: tokens.textPrimary, boxShadow: tokens.tileShadow }}
        onClick={() => fileInputRef.current?.click()}
      >
        Load
      </button>
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
