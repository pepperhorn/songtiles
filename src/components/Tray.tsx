import { useAppStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { Tile } from './Tile';

export function Tray() {
  const { tokens } = useTheme();
  const tray = useAppStore(s => s.tray);
  const tiles = useAppStore(s => s.tiles);
  const refill = useAppStore(s => s.refillTray);
  const discard = useAppStore(s => s.discardTrayTile);
  const capacity = useAppStore(s => s.trayCapacity);

  return (
    <div
      className="tray-root fixed bottom-0 left-0 right-0 px-4 pb-4 pt-3 flex items-center gap-3 overflow-x-auto"
      style={{ background: tokens.trayBg }}
    >
      {tray.map(id => (
        <button
          key={id}
          className="tray-slot"
          onDoubleClick={() => discard(id)}
          aria-label="tray tile"
        >
          <Tile tile={tiles[id]} size={72} />
        </button>
      ))}
      {Array.from({ length: Math.max(0, capacity - tray.length) }).map((_, i) => (
        <div
          key={`empty-${i}`}
          className="tray-empty"
          style={{ width: 72, height: 72, borderRadius: 14, border: `2px dashed ${tokens.gridDot}` }}
        />
      ))}
      <button
        className="tray-refill ml-auto px-4 py-2 rounded-full font-medium"
        style={{ background: tokens.topBarBg, color: tokens.textPrimary }}
        onClick={refill}
      >
        Refill
      </button>
    </div>
  );
}
