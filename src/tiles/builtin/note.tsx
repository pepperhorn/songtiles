import type { TileKind, RenderContentProps } from '../types';
import { midiToOctave, midiToPitchClass } from '../../constants/noteColors';

function NoteContent({ tile, size, tokens }: RenderContentProps) {
  if (tile.kind !== 'note') return null;
  const pc = midiToPitchClass(tile.pitch);
  const oct = midiToOctave(tile.pitch);
  return (
    <>
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
    </>
  );
}

export const NOTE_KIND: TileKind = {
  id: 'note',
  label: 'Note',
  renderContent: NoteContent,
  onTap(id, store) {
    store.getState().toggleBass(id);
  },
};
