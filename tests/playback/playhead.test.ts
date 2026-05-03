import { describe, it, expect } from 'vitest';
import { advancePlayhead } from '../../src/playback/playhead';
import { computeSegments } from '../../src/graph/segments';
import type { ScheduledNote } from '../../src/playback/events';
import type { Segment } from '../../src/graph/segments';
import type { Tile, TileId, Paint, PaintId } from '../../src/graph/types';

const n = (id: string, x: number, y: number, pitch = 60): Tile =>
  ({ id, cell: { x, y }, kind: 'note', pitch, bass: false } as Tile);

describe('advancePlayhead — sequential mode', () => {
  it('emits one event per note-tile in beat order (3-tile linear strand, 120 BPM)', () => {
    const beatSec = 60 / 120;
    const tiles: Record<TileId, Tile> = {
      t1: { id: 't1', kind: 'note', pitch: 60, bass: false, cell: { x: 0, y: 0 } },
      t2: { id: 't2', kind: 'note', pitch: 62, bass: false, cell: { x: 1, y: 0 } },
      t3: { id: 't3', kind: 'note', pitch: 64, bass: false, cell: { x: 2, y: 0 } },
    };
    const segments: Segment[] = [
      { rootId: 't1', tiles: ['t1', 't2', 't3'], endsAtIntersection: false },
    ];
    const emitted: ScheduledNote[] = [];

    advancePlayhead({
      segments, tiles, paints: {},
      startTime: 1.0, beatSec, windowEnd: 1.0 + 5 * beatSec,
      emit: ev => emitted.push(ev),
    });

    expect(emitted).toHaveLength(3);
    expect(emitted[0]).toMatchObject({ midi: 60, when: 1.0 });
    expect(emitted[1]).toMatchObject({ midi: 62, when: 1.5 });
    expect(emitted[2]).toMatchObject({ midi: 64, when: 2.0 });
  });

  it('respects windowEnd cutoff (strict <)', () => {
    const tiles: Record<TileId, Tile> = {
      t1: { id: 't1', kind: 'note', pitch: 60, bass: false, cell: { x: 0, y: 0 } },
      t2: { id: 't2', kind: 'note', pitch: 62, bass: false, cell: { x: 1, y: 0 } },
    };
    const segments: Segment[] = [
      { rootId: 't1', tiles: ['t1', 't2'], endsAtIntersection: false },
    ];
    const emitted: ScheduledNote[] = [];
    advancePlayhead({
      segments, tiles, paints: {},
      startTime: 1.0, beatSec: 0.5, windowEnd: 1.5,
      emit: ev => emitted.push(ev),
    });
    expect(emitted).toHaveLength(1);
    expect(emitted[0].midi).toBe(60);
  });
});

describe('advancePlayhead — bass mode', () => {
  it('bass-flipped tile emits a sustained bass voice clamped to C2..B2', () => {
    const tiles: Record<TileId, Tile> = {
      a: n('a', 0, 0, 60),
      b: { ...n('b', 1, 0, 79), bass: true } as Tile,
      c: n('c', 2, 0, 64),
    };
    const byCell: Record<string, TileId> = { '0,0': 'a', '1,0': 'b', '2,0': 'c' };
    const segs = computeSegments('a', tiles, byCell);
    const events: ScheduledNote[] = [];
    advancePlayhead({
      segments: segs, tiles, paints: {},
      startTime: 0, beatSec: 0.5, windowEnd: 10,
      emit: ev => events.push(ev),
    });

    const bass = events.find(e => e.midi === 43);
    expect(bass).toBeTruthy();
    expect(bass!.when).toBeCloseTo(0.5, 3);
    expect(bass!.duration).toBeCloseTo(1.0, 3);
    expect(events.some(e => e.midi === 60)).toBe(true);
    expect(events.some(e => e.midi === 79)).toBe(true);
    expect(events.some(e => e.midi === 64)).toBe(true);
  });
});

describe('advancePlayhead — repeat tiles', () => {
  it('finite repeat replays the section count times (open/close consume 0 beats)', () => {
    const tiles: Record<TileId, Tile> = {
      a: n('a', 0, 0, 60),
      o: { id: 'o', cell: { x: 1, y: 0 }, kind: 'repeat-open', count: 3 } as Tile,
      b: n('b', 2, 0, 62),
      c: { id: 'c', cell: { x: 3, y: 0 }, kind: 'repeat-close' } as Tile,
      d: n('d', 4, 0, 64),
    };
    const byCell: Record<string, TileId> = { '0,0': 'a', '1,0': 'o', '2,0': 'b', '3,0': 'c', '4,0': 'd' };
    const segs = computeSegments('a', tiles, byCell);
    const events: ScheduledNote[] = [];
    advancePlayhead({
      segments: segs, tiles, paints: {},
      startTime: 0, beatSec: 0.5, windowEnd: 100,
      emit: ev => events.push(ev),
    });
    const noteEvents = events.filter(e => e.midi >= 60 && e.midi <= 64);
    expect(noteEvents.map(e => e.midi)).toEqual([60, 62, 62, 62, 64]);
    expect(noteEvents.map(e => e.when)).toEqual([0, 0.5, 1.0, 1.5, 2.0]);
  });
});

describe('advancePlayhead — branching at intersection', () => {
  it('forks playheads at an intersection: both branches fire phase-locked', () => {
    const tiles: Record<TileId, Tile> = {
      a: n('a', 0, 0, 60), b: n('b', 1, 0, 62), c: n('c', 2, 0, 64),
      d: n('d', 2, 1, 65), e: n('e', 2, -1, 67),
    };
    const byCell: Record<string, TileId> = {
      '0,0': 'a', '1,0': 'b', '2,0': 'c', '2,1': 'd', '2,-1': 'e',
    };
    const segs = computeSegments('a', tiles, byCell);

    const emitted: ScheduledNote[] = [];
    advancePlayhead({
      segments: segs, tiles, paints: {},
      startTime: 0, beatSec: 0.5, windowEnd: 10,
      emit: ev => emitted.push(ev),
    });

    const atBeat = (beat: number) =>
      emitted.filter(e => Math.abs(e.when - beat * 0.5) < 1e-9).map(e => e.midi).sort((x, y) => x - y);

    expect(atBeat(0)).toEqual([60]);
    expect(atBeat(1)).toEqual([62]);
    expect(atBeat(2)).toEqual([64]);
    expect(atBeat(3)).toEqual([65, 67]);
    expect(emitted).toHaveLength(5);
  });
});

describe('advancePlayhead — paints', () => {
  it('chord paint: all paint tiles fire simultaneously when first hit, others silenced', () => {
    // a-b-c-d linear; chord paint covers {b, c} — when playhead reaches b, both
    // b and c fire at beat 1 with duration 2 * beatSec. c is silenced when
    // playhead reaches it at beat 2.
    const tiles: Record<TileId, Tile> = {
      a: n('a', 0, 0, 60), b: n('b', 1, 0, 62), c: n('c', 2, 0, 64), d: n('d', 3, 0, 67),
    };
    const segments: Segment[] = [
      { rootId: 'a', tiles: ['a', 'b', 'c', 'd'], endsAtIntersection: false },
    ];
    const paints: Record<PaintId, Paint> = {
      p1: { id: 'p1', kind: 'chord', tileIds: ['b', 'c'] },
    };

    const events: ScheduledNote[] = [];
    advancePlayhead({
      segments, tiles, paints,
      startTime: 0, beatSec: 0.5, windowEnd: 10,
      emit: ev => events.push(ev),
    });

    // beat 0: a (60) sequential
    // beat 1: chord fires {b=62, c=64} together, duration = 2 * 0.5 = 1.0
    // beat 2: c silenced (consumed by paint)
    // beat 3: d (67) sequential
    const at = (when: number) =>
      events.filter(e => Math.abs(e.when - when) < 1e-9).map(e => e.midi).sort((x, y) => x - y);

    expect(at(0)).toEqual([60]);
    expect(at(0.5)).toEqual([62, 64]);
    expect(at(1.5)).toEqual([67]);
    // No emit at when=1.0 (c was consumed by the chord paint at beat 1).
    expect(at(1.0)).toEqual([]);

    // Chord notes carry the N-tick duration.
    const chordEvents = events.filter(e => Math.abs(e.when - 0.5) < 1e-9);
    for (const ev of chordEvents) expect(ev.duration).toBeCloseTo(1.0, 3);
  });

  it('arp paint: pulses through N notes twice over N beats at half-tick intervals', () => {
    // Two-tile arp paint {b, c}; N=2; over N=2 beats at 2x rate = 4 pulses
    // (b, c, b, c) at when = 1, 1.25, 1.5, 1.75 (beatSec=0.5, pulseSec=0.25).
    const tiles: Record<TileId, Tile> = {
      a: n('a', 0, 0, 60), b: n('b', 1, 0, 62), c: n('c', 2, 0, 64), d: n('d', 3, 0, 67),
    };
    const segments: Segment[] = [
      { rootId: 'a', tiles: ['a', 'b', 'c', 'd'], endsAtIntersection: false },
    ];
    const paints: Record<PaintId, Paint> = {
      p1: { id: 'p1', kind: 'arp', tileIds: ['b', 'c'] },
    };

    const events: ScheduledNote[] = [];
    advancePlayhead({
      segments, tiles, paints,
      startTime: 0, beatSec: 0.5, windowEnd: 10,
      emit: ev => events.push(ev),
    });

    const arpEvents = events
      .filter(e => Math.abs(e.when - 0.5) < 1.0) // ignore neighbours
      .filter(e => e.midi === 62 || e.midi === 64)
      .sort((x, y) => x.when - y.when);

    expect(arpEvents.map(e => [e.midi, +e.when.toFixed(4)])).toEqual([
      [62, 0.5],   // pulse 0: b
      [64, 0.75],  // pulse 1: c
      [62, 1.0],   // pulse 2: b (cycle 2)
      [64, 1.25],  // pulse 3: c (cycle 2)
    ]);
    for (const ev of arpEvents) expect(ev.duration).toBeCloseTo(0.25, 3);
  });

  it('chord and arp overlapping the same tile both fire when first hit', () => {
    const tiles: Record<TileId, Tile> = {
      a: n('a', 0, 0, 60), b: n('b', 1, 0, 62), c: n('c', 2, 0, 64), d: n('d', 3, 0, 67),
    };
    const segments: Segment[] = [
      { rootId: 'a', tiles: ['a', 'b', 'c', 'd'], endsAtIntersection: false },
    ];
    // Chord {b, c, d} and arp {b, c} — tile b is in both.
    const paints: Record<PaintId, Paint> = {
      pChord: { id: 'pChord', kind: 'chord', tileIds: ['b', 'c', 'd'] },
      pArp:   { id: 'pArp',   kind: 'arp',   tileIds: ['b', 'c'] },
    };

    const events: ScheduledNote[] = [];
    advancePlayhead({
      segments, tiles, paints,
      startTime: 0, beatSec: 0.5, windowEnd: 10,
      emit: ev => events.push(ev),
    });

    // beat 0: a (60) plain.
    // beat 1: chord fires {62, 64, 67} simultaneously AND arp pulses begin.
    const atBeat1 = events.filter(e => Math.abs(e.when - 0.5) < 1e-9).map(e => e.midi).sort();
    // chord contributes 62, 64, 67. arp also contributes 62 (pulse 0 of arp).
    expect(atBeat1).toContain(62);
    expect(atBeat1).toContain(64);
    expect(atBeat1).toContain(67);
    // c (beat 2) and d (beat 3) silenced by chord paint consumption.
  });
});
