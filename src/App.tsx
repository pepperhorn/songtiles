import { useEffect } from 'react';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';
import { useAppStore } from './state/store';
import { Canvas } from './components/Canvas';
import { Tray } from './components/Tray';

function Inner() {
  const { tokens } = useTheme();
  const initSession = useAppStore(s => s.initSession);
  useEffect(() => { initSession({ trayCapacity: 8, repeatPoolSize: 5 }); }, [initSession]);
  return (
    <div className="app-root min-h-screen" style={{ background: tokens.canvasBg, color: tokens.textPrimary }}>
      <Canvas />
      <Tray />
    </div>
  );
}

export default function App() {
  return <ThemeProvider><Inner /></ThemeProvider>;
}
