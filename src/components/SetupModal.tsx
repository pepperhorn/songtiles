import { useState, type CSSProperties } from 'react';
import { useAppStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import type { TrayCapacity, RepeatPoolSize } from '../graph/types';

const CAPACITIES: TrayCapacity[] = [4, 6, 8, 9, 10, 11, 12];
const POOLS: RepeatPoolSize[] = [3, 5, 8, 12];

export function SetupModal({ onComplete }: { onComplete(): void }) {
  const { tokens } = useTheme();
  const [trayCapacity, setTrayCapacity] = useState<TrayCapacity>(8);
  const [repeatPoolSize, setRepeatPoolSize] = useState<RepeatPoolSize>(5);
  const initSession = useAppStore(s => s.initSession);

  const optionBase: CSSProperties = {
    minWidth: 44,
    minHeight: 36,
    border: `1px solid ${tokens.gridDot}`,
    color: tokens.textPrimary,
    background: 'transparent',
  };
  const optionSelected: CSSProperties = {
    background: tokens.tilePlayhead,
    color: '#fff',
    border: `1px solid ${tokens.tilePlayhead}`,
  };

  return (
    <div
      className="setup-overlay fixed inset-0 z-50 grid place-items-center px-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
    >
      <div
        className="setup-modal w-[min(420px,92vw)] p-6 rounded-3xl"
        style={{ background: tokens.topBarBg, color: tokens.textPrimary, boxShadow: tokens.tileShadow }}
      >
        <h2 className="setup-title text-2xl font-semibold mb-4">New session</h2>

        <div className="setup-row mb-4">
          <div className="setup-label text-sm opacity-60 mb-2">Tray capacity</div>
          <div className="setup-options flex flex-wrap gap-2">
            {CAPACITIES.map(c => (
              <button
                key={c}
                type="button"
                className="option-btn px-3 py-1 rounded-full text-sm font-medium"
                style={{ ...optionBase, ...(trayCapacity === c ? optionSelected : {}) }}
                onClick={() => setTrayCapacity(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="setup-row mb-6">
          <div className="setup-label text-sm opacity-60 mb-2">Repeat sets</div>
          <div className="setup-options flex flex-wrap gap-2">
            {POOLS.map(p => (
              <button
                key={p}
                type="button"
                className="option-btn px-3 py-1 rounded-full text-sm font-medium"
                style={{ ...optionBase, ...(repeatPoolSize === p ? optionSelected : {}) }}
                onClick={() => setRepeatPoolSize(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="setup-start w-full py-3 rounded-full font-semibold"
          style={{ background: tokens.tilePlayhead, color: '#fff' }}
          onClick={() => {
            initSession({ trayCapacity, repeatPoolSize });
            try { localStorage.setItem('songtiles.firstRunDone', 'yes'); } catch {}
            onComplete();
          }}
        >
          Start
        </button>
      </div>
    </div>
  );
}
