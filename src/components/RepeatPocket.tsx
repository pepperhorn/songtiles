import { useAppStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { PETALUMA_REPEAT_OPEN, PETALUMA_REPEAT_CLOSE } from '../constants/petaluma';

export function RepeatPocket() {
  const { tokens } = useTheme();
  const left = useAppStore(s => s.repeatSetsRemaining);
  const pull = useAppStore(s => s.pullRepeatPair);
  return (
    <div
      className="repeat-pocket fixed top-4 right-32 p-3 rounded-2xl flex items-center gap-3 z-10"
      style={{ background: tokens.topBarBg, color: tokens.textPrimary, boxShadow: tokens.tileShadow }}
    >
      <span className="petaluma text-3xl leading-none">{PETALUMA_REPEAT_OPEN}</span>
      <span className="petaluma text-3xl leading-none">{PETALUMA_REPEAT_CLOSE}</span>
      <button
        className="repeat-pull px-3 py-1 rounded-full text-sm"
        onClick={pull}
        disabled={left <= 0}
        style={{
          background: tokens.canvasBg,
          color: tokens.textPrimary,
          opacity: left <= 0 ? 0.4 : 1,
          cursor: left <= 0 ? 'not-allowed' : 'pointer',
        }}
      >
        Pull set ({left} left)
      </button>
    </div>
  );
}
