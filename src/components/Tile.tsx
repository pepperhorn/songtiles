import { useTheme } from '../theme/ThemeProvider';
import { midiToOctave, midiToPitchClass } from '../constants/noteColors';
import type { Tile as TileT } from '../graph/types';

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
  // Repeat tiles get their own visual in M13; placeholder until then.
  return (
    <div
      className="songtile repeat-tile grid place-items-center"
      style={{
        width: size, height: size, borderRadius: 14, background: tokens.trayBg, color: tokens.textPrimary,
        boxShadow: `${tokens.tileShadow}, ${tokens.tileBevel}`,
      }}
    >
      <span>{tile.kind === 'repeat-open' ? '⟦' : '⟧'}</span>
    </div>
  );
}
