import { useEffect, useRef, useState } from 'react';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';
import { useAppStore } from './state/store';
import { deserialiseSession } from './state/persistence';
import { Canvas } from './components/Canvas';
import { Tray } from './components/Tray';
import { SetupModal } from './components/SetupModal';
import { SoundPicker } from './components/SoundPicker';
import { PaintToolbar } from './components/PaintToolbar';
import { Wordmark } from './components/Wordmark';

function Inner() {
  const { tokens, mode, setMode } = useTheme();
  const initSession = useAppStore(s => s.initSession);
  const isPlaying = useAppStore(s => s.isPlaying);
  const audioReady = useAppStore(s => s.audioReady);
  const initAudio = useAppStore(s => s.initAudio);
  const play = useAppStore(s => s.play);
  const stop = useAppStore(s => s.stop);
  const recordSong = useAppStore(s => s.recordSong);
  const [recording, setRecording] = useState(false);
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
          trayCapacity: f.trayCapacity, wildness: f.wildness,
          gameMode: f.gameMode, scaleRoot: f.scaleRoot, scaleType: f.scaleType,
          bpm: f.bpm, patchId: f.patchId, isPlaying: false,
        });
        return;
      }
    } catch {}
    initSession({ trayCapacity: 8, wildness: 'wild', gameMode: 'explorer' });
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

  // Cardboard-arcade button base. The chunky offset shadow comes from
  // .btn-chunky in index.css; this just supplies the colours.
  const chunky = {
    background: tokens.topBarBg,
    color: tokens.textPrimary,
    pointerEvents: 'auto' as const,
    fontWeight: 700,
  };

  return (
    <div
      className="app-root min-h-screen bg-paper"
      style={{ background: tokens.canvasBg, color: tokens.textPrimary }}
    >
      {showSetup && <SetupModal onComplete={() => setShowSetup(false)} />}
      {!showSetup && !audioReady && (
        <div
          className="audio-unlock-overlay fixed inset-0 z-30 grid place-items-center"
          style={{ background: 'rgba(14, 20, 33, 0.62)' }}
        >
          <button
            type="button"
            className="audio-unlock-btn btn-chunky px-7 py-5 rounded-xl text-lg"
            style={{ background: '#ff5b4a', color: '#fff8eb', fontWeight: 800, letterSpacing: '0.01em' }}
            onClick={() => initAudio()}
            aria-label="start audio"
          >
            ▶ Tap to play
          </button>
        </div>
      )}
      <Canvas />
      <Tray />

      {/* Top-bar holds the wordmark on the left and the toolbar pile on the
          right. They sit on a translucent strip so the canvas reads through. */}
      <div
        className="top-bar fixed top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-3 z-10 px-3 py-2 rounded-2xl"
        style={{
          pointerEvents: 'none',
          background: tokens.toolbarStripBg,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: `2px solid var(--chunky-edge)`,
          boxShadow: '4px 4px 0 0 var(--chunky-edge)',
        }}
      >
        <Wordmark />
        <div className="toolbar-cluster flex flex-wrap items-center gap-2">
          <button
            className="new-game-btn btn-chunky px-3 py-2 rounded-lg text-sm"
            style={chunky}
            onClick={newGame}
            aria-label="new game"
          >
            New
          </button>
          <button
            className="save-btn btn-chunky px-3 py-2 rounded-lg text-sm"
            style={chunky}
            onClick={() => saveToFile()}
          >
            Save
          </button>
          <button
            className="load-btn btn-chunky px-3 py-2 rounded-lg text-sm"
            style={chunky}
            onClick={() => fileInputRef.current?.click()}
          >
            Load
          </button>
          <div
            className="bpm-control btn-chunky flex items-center gap-1 rounded-lg px-1.5 py-1"
            style={chunky}
          >
            <button
              className="bpm-down w-8 h-8 rounded-md font-bold text-base grid place-items-center"
              style={{ background: tokens.canvasBg, color: tokens.textPrimary, border: '2px solid var(--chunky-edge)' }}
              aria-label="bpm down"
              onClick={() => setBpm(bpm - 4)}
            >
              −
            </button>
            <span
              className="bpm-value tabular-nums text-sm px-1"
              style={{ minWidth: 64, textAlign: 'center', fontWeight: 700 }}
            >
              {bpm} bpm
            </span>
            <button
              className="bpm-up w-8 h-8 rounded-md font-bold text-base grid place-items-center"
              style={{ background: tokens.canvasBg, color: tokens.textPrimary, border: '2px solid var(--chunky-edge)' }}
              aria-label="bpm up"
              onClick={() => setBpm(bpm + 4)}
            >
              +
            </button>
          </div>
          <PaintToolbar />
          <SoundPicker />
          <button
            className="theme-toggle btn-chunky w-10 h-10 rounded-lg text-base grid place-items-center"
            style={chunky}
            onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
            aria-label={mode === 'dark' ? 'switch to light theme' : 'switch to dark theme'}
            title={mode === 'dark' ? 'Light' : 'Dark'}
          >
            <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>
              {mode === 'dark' ? '☀' : '☾'}
            </span>
          </button>
          <button
            className="record-btn btn-chunky w-10 h-10 rounded-lg grid place-items-center"
            style={{
              ...chunky,
              background: recording ? '#dc2626' : chunky.background,
              color: recording ? '#fff' : chunky.color,
              opacity: isPlaying && !recording ? 0.55 : 1,
            }}
            onClick={async () => {
              if (recording || isPlaying) return;
              setRecording(true);
              try { await recordSong(); }
              catch (err) { alert((err as Error).message); }
              finally { setRecording(false); }
            }}
            aria-label={recording ? 'recording…' : 'record song to video'}
            title={recording ? 'Recording…' : 'Record video'}
            disabled={recording || isPlaying}
          >
            <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>
              {recording ? '●' : '⏺'}
            </span>
          </button>
          <button
            className={`play-stop btn-chunky px-5 py-2 rounded-lg text-base ${isPlaying ? '' : 'play-pulse'}`}
            style={{
              ...chunky,
              background: isPlaying ? '#3b3a36' : '#06d6a0',
              color: isPlaying ? '#fff8eb' : '#0e1421',
              fontWeight: 800,
              letterSpacing: '0.04em',
              textShadow: isPlaying ? '0 1px 0 rgba(0,0,0,0.5)' : '0 1px 0 rgba(255,255,255,0.4)',
            }}
            onClick={() => isPlaying ? stop() : play()}
          >
            {isPlaying ? '■ STOP' : '▶ PLAY'}
          </button>
        </div>
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
