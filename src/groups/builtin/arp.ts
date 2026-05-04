import type { GroupType } from '../types';
import type { NoteTile } from '../../graph/types';

export const ARP_GROUP: GroupType = {
  id: 'arp',
  label: 'Arp',
  icon: '∿',
  color: '#a855f7',
  onFire({ group, tiles, when, beatSec, emit }) {
    const notes = group.tileIds
      .map(id => tiles[id])
      .filter((t): t is NoteTile => t?.kind === 'note');
    const N = notes.length;
    if (N === 0) return;
    const pulseSec = beatSec / 2;
    const totalPulses = 2 * N;
    for (let k = 0; k < totalPulses; k++) {
      const nt = notes[k % N];
      emit({
        midi: nt.pitch,
        when: when + k * pulseSec,
        duration: pulseSec,
        velocity: 0.8,
        tileId: nt.id,
      });
    }
  },
};
