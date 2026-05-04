import { useState, useMemo, type CSSProperties } from 'react';
import { useAppStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import type { TrayCapacity, Wildness } from '../graph/types';
import { listGameModes } from '../games/registry';
import type { GameModeId } from '../games/types';

const CAPACITIES: TrayCapacity[] = [6, 8, 12];
const WILDNESS_LADDER: Array<{ key: Wildness; label: string; hint: string }> = [
  { key: 'tame',   label: 'Tame',   hint: '5%'  },
  { key: 'wild',   label: 'Wild',   hint: '10%' },
  { key: 'wilder', label: 'Wilder', hint: '15%' },
];

export function SetupModal({ onComplete }: { onComplete(): void }) {
  const { tokens } = useTheme();
  const modes = useMemo(() => listGameModes(), []);
  const [trayCapacity, setTrayCapacity] = useState<TrayCapacity>(8);
  const [wildness, setWildness] = useState<Wildness>('wild');
  const [gameMode, setGameMode] = useState<GameModeId>(modes[0]?.id ?? 'explorer');
  const [gameParams, setGameParams] = useState<unknown>(modes[0]?.defaultParams ?? {});
  const initSession = useAppStore(s => s.initSession);
  const initAudio = useAppStore(s => s.initAudio);

  const selectedMode = modes.find(m => m.id === gameMode);

  function selectMode(id: GameModeId) {
    setGameMode(id);
    const m = modes.find(mm => mm.id === id);
    setGameParams(m?.defaultParams ?? {});
  }

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

  const SetupExtras = selectedMode?.SetupExtras;

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

        {/* Mode picker — driven by registered game modes */}
        <div className="setup-row mb-5">
          <div className="setup-label text-xs uppercase tracking-wider opacity-70 mb-2 font-semibold">Mode</div>
          <div className="setup-options flex gap-2 flex-wrap">
            {modes.map(m => {
              const active = gameMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  className="option-btn flex-1 px-3 py-3 rounded-lg text-sm text-left"
                  style={{ ...optionBase, ...(active ? optionSelected : {}) }}
                  onClick={() => selectMode(m.id)}
                >
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{m.label}</div>
                  <div style={{ fontWeight: 500, fontSize: 11, opacity: 0.75, marginTop: 2 }}>{m.blurb}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mode-specific setup extras (e.g. scale picker) */}
        {SetupExtras && <SetupExtras params={gameParams} setParams={setGameParams} />}

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
            initSession({ trayCapacity, wildness, gameMode, gameParams });
            try { localStorage.setItem('doremino.firstRunDone', 'yes'); } catch {}
            onComplete();
          }}
        >
          ▶ START
        </button>
      </div>
    </div>
  );
}
