import { useState, type CSSProperties } from 'react';
import { useAppStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import type { TrayCapacity, Wildness, GameMode, ScaleRoot, ScaleType } from '../graph/types';
import { ScaleWheel } from './ScaleWheel';

const CAPACITIES: TrayCapacity[] = [6, 8, 12];
const WILDNESS_LADDER: Array<{ key: Wildness; label: string; hint: string }> = [
  { key: 'tame',   label: 'Tame',   hint: '5%'  },
  { key: 'wild',   label: 'Wild',   hint: '10%' },
  { key: 'wilder', label: 'Wilder', hint: '15%' },
];
const MODES: Array<{ key: GameMode; label: string; blurb: string }> = [
  { key: 'explorer', label: 'Explorer', blurb: 'Every note. Make any song.' },
  { key: 'scale',    label: 'Scale',    blurb: 'Just notes in your scale.' },
];

const PITCH_NAMES: string[] = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export function SetupModal({ onComplete }: { onComplete(): void }) {
  const { tokens } = useTheme();
  const [trayCapacity, setTrayCapacity] = useState<TrayCapacity>(8);
  const [wildness, setWildness] = useState<Wildness>('wild');
  const [gameMode, setGameMode] = useState<GameMode>('explorer');
  const [scaleRoot, setScaleRoot] = useState<ScaleRoot>(0);
  const [scaleType, setScaleType] = useState<ScaleType>('major');
  const initSession = useAppStore(s => s.initSession);
  const initAudio = useAppStore(s => s.initAudio);

  const optionBase: CSSProperties = {
    minWidth: 56,
    minHeight: 40,
    border: '2px solid var(--chunky-edge)',
    color: tokens.textPrimary,
    background: tokens.canvasBg,
    fontWeight: 700,
    boxShadow: '2px 2px 0 0 var(--chunky-edge)',
  };
  const optionSelected: CSSProperties = {
    background: '#06d6a0',
    color: '#0e1421',
  };

  return (
    <div
      className="setup-overlay fixed inset-0 z-50 grid place-items-center px-4"
      style={{ background: 'rgba(14, 20, 33, 0.6)' }}
    >
      <div
        className="setup-modal w-[min(440px,94vw)] p-6 rounded-2xl"
        style={{
          background: tokens.topBarBg,
          color: tokens.textPrimary,
          border: '2px solid var(--chunky-edge)',
          boxShadow: '5px 5px 0 0 var(--chunky-edge)',
        }}
      >
        <h2
          className="setup-title text-3xl font-bold mb-1"
          style={{ letterSpacing: '-0.03em' }}
        >
          New session
        </h2>
        <p className="setup-sub text-sm opacity-70 mb-5">Pick a vibe.</p>

        {/* Mode picker */}
        <div className="setup-row mb-5">
          <div className="setup-label text-xs uppercase tracking-wider opacity-70 mb-2 font-semibold">Mode</div>
          <div className="setup-options flex gap-2">
            {MODES.map(m => {
              const active = gameMode === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  className="option-btn flex-1 px-3 py-3 rounded-lg text-sm text-left"
                  style={{ ...optionBase, ...(active ? optionSelected : {}) }}
                  onClick={() => setGameMode(m.key)}
                >
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{m.label}</div>
                  <div style={{ fontWeight: 500, fontSize: 11, opacity: 0.75, marginTop: 2 }}>{m.blurb}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scale picker (only when mode === 'scale') */}
        {gameMode === 'scale' && (
          <div className="setup-row mb-5">
            <div className="setup-label text-xs uppercase tracking-wider opacity-70 mb-2 font-semibold">Scale</div>
            <div className="flex gap-3 items-stretch">
              <ScaleWheel
                items={PITCH_NAMES}
                selected={scaleRoot}
                onChange={i => setScaleRoot(i as ScaleRoot)}
              />
              <div className="flex flex-col gap-2 flex-1">
                {(['major', 'minor'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    className="px-3 py-2 rounded-lg text-sm flex-1"
                    style={{ ...optionBase, ...(scaleType === t ? optionSelected : {}) }}
                    onClick={() => setScaleType(t)}
                  >
                    {t === 'major' ? 'Major' : 'Minor'}
                  </button>
                ))}
                <div className="text-xs opacity-60 mt-1 px-1">
                  {PITCH_NAMES[scaleRoot]} {scaleType}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tray capacity */}
        <div className="setup-row mb-5">
          <div className="setup-label text-xs uppercase tracking-wider opacity-70 mb-2 font-semibold">Tray size</div>
          <div className="setup-options flex gap-2">
            {CAPACITIES.map(c => (
              <button
                key={c}
                type="button"
                className="option-btn flex-1 px-3 py-2 rounded-lg text-base"
                style={{ ...optionBase, ...(trayCapacity === c ? optionSelected : {}) }}
                onClick={() => setTrayCapacity(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Wildness */}
        <div className="setup-row mb-6">
          <div className="setup-label text-xs uppercase tracking-wider opacity-70 mb-2 font-semibold">Wildcards</div>
          <div className="setup-options flex gap-2">
            {WILDNESS_LADDER.map(w => (
              <button
                key={w.key}
                type="button"
                className="option-btn flex-1 px-3 py-2 rounded-lg text-sm"
                style={{ ...optionBase, ...(wildness === w.key ? optionSelected : {}) }}
                onClick={() => setWildness(w.key)}
              >
                <div style={{ fontWeight: 800 }}>{w.label}</div>
                <div style={{ fontWeight: 500, fontSize: 11, opacity: 0.75 }}>{w.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="setup-start btn-chunky w-full py-3 rounded-lg"
          style={{
            background: '#06d6a0',
            color: '#0e1421',
            fontWeight: 800,
            letterSpacing: '0.04em',
            fontSize: 16,
          }}
          onClick={() => {
            initAudio();
            initSession({
              trayCapacity, wildness, gameMode,
              ...(gameMode === 'scale' ? { scaleRoot, scaleType } : {}),
            });
            try { localStorage.setItem('songtiles.firstRunDone', 'yes'); } catch {}
            onComplete();
          }}
        >
          ▶ START
        </button>
      </div>
    </div>
  );
}
