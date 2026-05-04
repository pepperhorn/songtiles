import type { GroupType } from '../types';
import type { NoteTile } from '../../graph/types';

export const CHORD_GROUP: GroupType = {
  id: 'chord',
  label: 'Chord',
  icon: '♬',
  color: '#3b82f6',
  onFire({ group, tiles, when, beatSec, emit }) {
    const notes = group.tileIds
      .map(id => tiles[id])
      .filter((t): t is NoteTile => t?.kind === 'note');
    if (notes.length === 0) return;
    const dur = notes.length * beatSec;
    for (const nt of notes) {
      emit({ midi: nt.pitch, when, duration: dur, velocity: 0.8, tileId: nt.id });
    }
  },
};
