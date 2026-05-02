import { useTheme } from '../theme/ThemeProvider';
import { midiToOctave, midiToPitchClass } from '../constants/noteColors';
import type { Tile as TileT } from '../graph/types';
import { PETALUMA_REPEAT_OPEN, PETALUMA_REPEAT_CLOSE } from '../constants/petaluma';

export function Tile({ tile, size = 96, dimmed = false }: { tile: TileT; size?: number; dimmed?: boolean }) {
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
    const glyph = tile.kind === 'repeat-open' ? PETALUMA_REPEAT_OPEN : PETALUMA_REPEAT_CLOSE;
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
        }}
      >
        <span className="repeat-glyph petaluma" style={{ fontSize: size * 0.7 }}>{glyph}</span>
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
