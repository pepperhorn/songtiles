import { useTheme } from '../theme/ThemeProvider';
import { midiToOctave, midiToPitchClass } from '../constants/noteColors';
import type { Tile as TileT } from '../graph/types';

// Pixel-perfect repeat barline drawn as SVG. `side` defaults to 'open' for
// tiles in the tray and any unpaired tile on the canvas; the canvas flips
// the trailing partner of a paired section to 'close' so the dots face back
// into the loop.
function RepeatGlyph({ side, size }: { side: 'open' | 'close'; size: number }) {
  const glyphSize = size * 0.62;
  return (
    <svg
      className="repeat-glyph-svg"
      width={glyphSize} height={glyphSize}
      viewBox="0 0 100 100"
      fill="currentColor"
      style={{ display: 'block' }}
      aria-hidden
    >
      {side === 'open' ? (
        <>
          <rect x="33" y="15" width="9" height="70" rx="1.5" />
          <rect x="48" y="15" width="3" height="70" rx="1" />
          <circle cx="62" cy="38" r="5" />
          <circle cx="62" cy="62" r="5" />
        </>
      ) : (
        <>
          <circle cx="38" cy="38" r="5" />
          <circle cx="38" cy="62" r="5" />
          <rect x="49" y="15" width="3" height="70" rx="1" />
          <rect x="58" y="15" width="9" height="70" rx="1.5" />
        </>
      )}
    </svg>
  );
}

export function Tile({
  tile, size = 96, dimmed = false, orientation = 'h', repeatSide = 'open', shadow,
}: {
  tile: TileT;
  size?: number;
  dimmed?: boolean;
  orientation?: 'h' | 'v';
  repeatSide?: 'open' | 'close';
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
    // Show the count on every repeat so the user can dial it in before pairing.
    // Once paired, the OPEN-side count is the one that drives playback.
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
          className="repeat-glyph-wrap grid place-items-center"
          style={{
            transform: orientation === 'v' ? 'rotate(90deg)' : undefined,
          }}
        >
          <RepeatGlyph side={repeatSide} size={size} />
        </span>
        <span
          className="repeat-count absolute bottom-1.5 right-2 text-xs font-medium"
          style={{ color: tokens.textPrimary }}
        >
          {countLabel}
        </span>
      </div>
    );
  }
}
