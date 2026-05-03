import { useTheme } from '../theme/ThemeProvider';
import { midiToOctave, midiToPitchClass } from '../constants/noteColors';
import type { Tile as TileT } from '../graph/types';

export function Tile({
  tile, size = 96, dimmed = false, shadow,
}: {
  tile: TileT;
  size?: number;
  dimmed?: boolean;
  /** Override the chunky drop shadow (e.g. tint by paint/repeat membership). */
  shadow?: string;
}) {
  const { tokens } = useTheme();
  if (tile.kind === 'note') {
    const pc = midiToPitchClass(tile.pitch);
    const oct = midiToOctave(tile.pitch);
    return (
      <div
        className="songtile note-tile relative grid place-items-center select-none"
        style={{
          width: size, height: size, borderRadius: 14,
          background: tokens.noteBg(pc), color: '#fff',
          border: '2px solid var(--chunky-edge)',
          boxShadow: `${shadow ?? tokens.tileShadow}, ${tokens.tileBevel}`,
          opacity: dimmed ? 0.4 : 1,
        }}
      >
        <span
          className="note-name"
          style={{
            fontSize: size * 0.46,
            textShadow: tokens.noteTextShadow,
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontWeight: 800,
            letterSpacing: '-0.04em',
          }}
        >
          {pc}
        </span>
        <span
          className="note-octave absolute bottom-1.5 right-2 text-xs opacity-90"
          style={{ textShadow: tokens.noteTextShadow }}
        >
          {oct}
        </span>
        {tile.bass && (
          <span
            className="bass-arrow absolute top-1.5 left-2 text-xs"
            style={{ textShadow: tokens.noteTextShadow }}
          >
            ↓
          </span>
        )}
      </div>
    );
  }
  if (tile.kind === 'repeat') {
    // Single Repeat tile — text label + tap-cycled count. Replaces the old
    // open/close pair model. Place one on a strand to loop everything from
    // the strand start to this tile.
    const countLabel = tile.count === 'inf' ? '∞' : `${tile.count}×`;
    return (
      <div
        className="songtile repeat-tile relative grid place-items-center select-none"
        style={{
          width: size, height: size, borderRadius: 14,
          background: tokens.trayBg, color: tokens.textPrimary,
          border: '2px solid var(--chunky-edge)',
          boxShadow: `${shadow ?? tokens.tileShadow}, ${tokens.tileBevel}`,
          overflow: 'hidden',
        }}
      >
        <span
          className="repeat-label"
          style={{
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontWeight: 800,
            fontSize: size * 0.18,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Repeat
        </span>
        <span
          className="repeat-count absolute bottom-1.5 right-2 tabular-nums"
          style={{ color: tokens.textPrimary, fontWeight: 700, fontSize: size * 0.13 }}
        >
          {countLabel}
        </span>
      </div>
    );
  }
}
