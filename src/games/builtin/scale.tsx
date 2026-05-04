import type { CSSProperties } from 'react';
import type { GameMode, SetupExtrasProps } from '../types';
import type { ScaleRoot, ScaleType } from '../../graph/types';
import { SCALE_INTERVALS } from '../../graph/types';
import { buildDeckFromPitchClasses } from './deckHelpers';
import { ScaleWheel } from '../../components/ScaleWheel';
import { useTheme } from '../../theme/ThemeProvider';

export interface ScaleParams { root: ScaleRoot; type: ScaleType }

const PITCH_NAMES: string[] = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

function ScaleSetupExtras({ params, setParams }: SetupExtrasProps<ScaleParams>) {
  const { tokens } = useTheme();
  const optionBase: CSSProperties = {
    minWidth: 56,
    minHeight: 40,
    border: '2px solid var(--chunky-edge)',
    color: tokens.textPrimary,
    background: tokens.canvasBg,
    fontWeight: 700,
    boxShadow: '2px 2px 0 0 var(--chunky-edge)',
  };
  const optionSelected: CSSProperties = { background: '#06d6a0', color: '#0e1421' };

  return (
    <div className="setup-row mb-5">
      <div className="setup-label text-xs uppercase tracking-wider opacity-70 mb-2 font-semibold">Scale</div>
      <div className="flex gap-3 items-stretch">
        <ScaleWheel
          items={PITCH_NAMES}
          selected={params.root}
          onChange={i => setParams({ ...params, root: i as ScaleRoot })}
        />
        <div className="flex flex-col gap-2 flex-1">
          {(['major', 'minor'] as const).map(t => (
            <button
              key={t}
              type="button"
              className="px-3 py-2 rounded-lg text-sm flex-1"
              style={{ ...optionBase, ...(params.type === t ? optionSelected : {}) }}
              onClick={() => setParams({ ...params, type: t })}
            >
              {t === 'major' ? 'Major' : 'Minor'}
            </button>
          ))}
          <div className="text-xs opacity-60 mt-1 px-1">
            {PITCH_NAMES[params.root]} {params.type}
          </div>
        </div>
      </div>
    </div>
  );
}

export const SCALE_MODE: GameMode<ScaleParams> = {
  id: 'scale',
  label: 'Scale',
  blurb: 'Just notes in your scale.',
  defaultParams: { root: 0, type: 'major' },
  buildDeck({ wildness, params, rng }) {
    const p = params as ScaleParams;
    if (typeof p?.root !== 'number' || (p.type !== 'major' && p.type !== 'minor')) {
      throw new Error('scale mode requires params { root, type }');
    }
    const intervals = SCALE_INTERVALS[p.type];
    const pcSet = new Set(intervals.map(s => (p.root + s) % 12));
    return buildDeckFromPitchClasses(pcSet, wildness, rng);
  },
  SetupExtras: ScaleSetupExtras,
};
