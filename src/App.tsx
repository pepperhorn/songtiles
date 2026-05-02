import { useEffect } from 'react';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';
import { useAppStore } from './state/store';
import { Tray } from './components/Tray';

function Inner() {
  const { tokens } = useTheme();
  const initSession = useAppStore(s => s.initSession);
  useEffect(() => { initSession({ trayCapacity: 8, repeatPoolSize: 5 }); }, [initSession]);
  return (
    <div className="app-root min-h-screen" style={{ background: tokens.canvasBg, color: tokens.textPrimary }}>
      <div className="canvas-placeholder grid place-items-center h-screen">canvas goes here</div>
      <Tray />
    </div>
  );
}

export default function App() {
  return <ThemeProvider><Inner /></ThemeProvider>;
}
