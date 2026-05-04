import { describe, it, expect } from 'vitest';
import { CHORD_GROUP } from '../../src/groups/builtin/chord';
import { ARP_GROUP } from '../../src/groups/builtin/arp';
import type { Group } from '../../src/groups/types';
import type { Tile } from '../../src/graph/types';
import type { ScheduledNote } from '../../src/playback/events';

const tiles: Record<string, Tile> = {
  a: { id: 'a', kind: 'note', pitch: 60, bass: false, cell: { x: 0, y: 0 } },
  b: { id: 'b', kind: 'note', pitch: 64, bass: false, cell: { x: 1, y: 0 } },
  c: { id: 'c', kind: 'note', pitch: 67, bass: false, cell: { x: 2, y: 0 } },
};

describe('chord group', () => {
  it('emits all notes at the same time with duration = N * beatSec', () => {
    const out: ScheduledNote[] = [];
    const group: Group = { id: 'g', typeId: 'chord', tileIds: ['a', 'b', 'c'] };
    CHORD_GROUP.onFire({ group, tiles, when: 1.0, beatSec: 0.5, emit: n => out.push(n) });
    expect(out).toHaveLength(3);
    expect(out.every(n => n.when === 1.0)).toBe(true);
    expect(out.every(n => n.duration === 1.5)).toBe(true);
    expect(out.map(n => n.midi).sort()).toEqual([60, 64, 67]);
  });
});

describe('arp group', () => {
  it('emits 2N pulses at beatSec/2 spacing, cycling tiles twice', () => {
    const out: ScheduledNote[] = [];
    const group: Group = { id: 'g', typeId: 'arp', tileIds: ['a', 'b', 'c'] };
    ARP_GROUP.onFire({ group, tiles, when: 0, beatSec: 0.5, emit: n => out.push(n) });
    expect(out).toHaveLength(6);
    expect(out.map(n => n.midi)).toEqual([60, 64, 67, 60, 64, 67]);
    expect(out.map(n => n.when)).toEqual([0, 0.25, 0.5, 0.75, 1.0, 1.25]);
    expect(out.every(n => n.duration === 0.25)).toBe(true);
  });

  it('skips non-note tiles', () => {
    const out: ScheduledNote[] = [];
    const tilesWithRepeat: Record<string, Tile> = {
      ...tiles,
      r: { id: 'r', kind: 'repeat', count: 2, cell: null },
    };
    const group: Group = { id: 'g', typeId: 'arp', tileIds: ['a', 'r', 'b'] };
    ARP_GROUP.onFire({ group, tiles: tilesWithRepeat, when: 0, beatSec: 1, emit: n => out.push(n) });
    expect(out.map(n => n.midi)).toEqual([60, 64, 60, 64]);
  });
});
