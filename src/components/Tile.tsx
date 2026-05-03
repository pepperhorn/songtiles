import { useTheme } from '../theme/ThemeProvider';
import { midiToOctave, midiToPitchClass } from '../constants/noteColors';
import type { Tile as TileT } from '../graph/types';

// Pixel-perfect repeat barline drawn as SVG so it always sits centred within
// the tile, regardless of font metrics. viewBox is 100x100; the assembly
// (thick bar + thin bar + two dots) is centred horizontally around x=50.
function RepeatGlyph({ kind, size }: { kind: 'repeat-open' | 'repeat-close'; size: number }) {
  const isOpen = kind === 'repeat-open';
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
      {isOpen ? (
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
  tile, size = 96, dimmed = false, orientation = 'h',
}: { tile: TileT; size?: number; dimmed?: boolean; orientation?: 'h' | 'v' }) {
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
          boxShadow: `${tokens.tileShadow}, ${tokens.tileBevel}`,
          opacity: dimmed ? 0.4 : 1,
        }}
      >
        <span className="note-name font-semibold" style={{ fontSize: size * 0.42 }}>{pc}</span>
        <span className="note-octave absolute bottom-1.5 right-2 text-xs opacity-80">{oct}</span>
        {tile.bass && <span className="bass-arrow absolute top-1.5 left-2 text-xs">↓</span>}
      </div>
    );
  }
  if (tile.kind === 'repeat-open' || tile.kind === 'repeat-close') {
    const countLabel = tile.kind === 'repeat-open'
      ? (tile.count === 'inf' ? '∞' : `${tile.count}×`)
      : null;
    return (
      <div
        className="songtile repeat-tile relative grid place-items-center select-none"
        style={{
          width: size, height: size, borderRadius: 14,
          background: tokens.trayBg, color: tokens.textPrimary,
          boxShadow: `${tokens.tileShadow}, ${tokens.tileBevel}`,
          overflow: 'hidden',
        }}
      >
        <span
          className="repeat-glyph-wrap grid place-items-center"
          style={{
            transform: orientation === 'v' ? 'rotate(90deg)' : undefined,
          }}
        >
          <RepeatGlyph kind={tile.kind} size={size} />
        </span>
        {countLabel && (
          <span
            className="repeat-count absolute bottom-1.5 right-2 text-xs font-medium"
            style={{ color: tokens.textPrimary }}
          >
            {countLabel}
          </span>
        )}
      </div>
    );
  }
}
