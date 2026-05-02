import { useEffect } from 'react';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';
import { useAppStore } from './state/store';
import { Canvas } from './components/Canvas';
import { Tray } from './components/Tray';
import { DetailPanel } from './components/DetailPanel';
import { RepeatPocket } from './components/RepeatPocket';

function Inner() {
  const { tokens } = useTheme();
  const initSession = useAppStore(s => s.initSession);
  const isPlaying = useAppStore(s => s.isPlaying);
  const play = useAppStore(s => s.play);
  const stop = useAppStore(s => s.stop);
  useEffect(() => { initSession({ trayCapacity: 8, repeatPoolSize: 5 }); }, [initSession]);
  return (
    <div className="app-root min-h-screen" style={{ background: tokens.canvasBg, color: tokens.textPrimary }}>
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
    </div>
  );
}

export default function App() {
  return <ThemeProvider><Inner /></ThemeProvider>;
}
