import { describe, it, expect } from 'vitest';
import { advancePlayhead } from '../../src/playback/playhead';
import { computeSegments } from '../../src/graph/segments';
import type { ScheduledNote } from '../../src/playback/events';
import type { Segment } from '../../src/graph/segments';
import type { Tile, TileId, SegmentSettings } from '../../src/graph/types';

const n = (id: string, x: number, y: number, pitch = 60): Tile =>
  ({ id, cell: { x, y }, kind: 'note', pitch, bass: false } as Tile);

describe('advancePlayhead — sequential mode', () => {
  it('emits one event per note-tile in beat order (3-tile linear strand, 120 BPM)', () => {
    const beatSec = 60 / 120; // 0.5s

    const tiles: Record<TileId, Tile> = {
      t1: { id: 't1', kind: 'note', pitch: 60, bass: false, cell: { x: 0, y: 0 } },
      t2: { id: 't2', kind: 'note', pitch: 62, bass: false, cell: { x: 1, y: 0 } },
      t3: { id: 't3', kind: 'note', pitch: 64, bass: false, cell: { x: 2, y: 0 } },
    };

    const segments: Segment[] = [
      { rootId: 't1', tiles: ['t1', 't2', 't3'], endsAtIntersection: false },
    ];

    const segmentSettings: Record<TileId, SegmentSettings> = {};

    const emitted: ScheduledNote[] = [];
    const startTime = 1.0;
    const windowEnd = startTime + 5 * beatSec;

    advancePlayhead({
      segments,
      segmentSettings,
      tiles,
      startTime,
      beatSec,
      windowEnd,
      emit: n => emitted.push(n),
    });

    expect(emitted).toHaveLength(3);
    expect(emitted[0]).toMatchObject({ midi: 60, when: 1.0 });
    expect(emitted[1]).toMatchObject({ midi: 62, when: 1.5 });
    expect(emitted[2]).toMatchObject({ midi: 64, when: 2.0 });
  });

  it('respects windowEnd cutoff (strict <)', () => {
    const beatSec = 60 / 120; // 0.5s
    const tiles: Record<TileId, Tile> = {
      t1: { id: 't1', kind: 'note', pitch: 60, bass: false, cell: { x: 0, y: 0 } },
      t2: { id: 't2', kind: 'note', pitch: 62, bass: false, cell: { x: 1, y: 0 } },
    };
    const segments: Segment[] = [
      { rootId: 't1', tiles: ['t1', 't2'], endsAtIntersection: false },
    ];
    const emitted: ScheduledNote[] = [];
    // windowEnd exactly at beat 1 (t2's when), so t2 should NOT be emitted
    advancePlayhead({
      segments,
      segmentSettings: {},
      tiles,
      startTime: 1.0,
      beatSec,
      windowEnd: 1.5, // t2 would be at 1.5, which is >= windowEnd
      emit: n => emitted.push(n),
    });
    expect(emitted).toHaveLength(1);
    expect(emitted[0].midi).toBe(60);
  });

  it('solid mode with single note fires at beat 0 with hold duration', () => {
    const beatSec = 0.5;
    const tiles: Record<TileId, Tile> = {
      t1: { id: 't1', kind: 'note', pitch: 60, bass: false, cell: { x: 0, y: 0 } },
    };
    const segments: Segment[] = [
      { rootId: 't1', tiles: ['t1'], endsAtIntersection: false },
    ];
    const segmentSettings: Record<TileId, SegmentSettings> = {
      t1: { segmentRootId: 't1', mode: 'solid', holdBeats: 2 },
    };
    const emitted: ScheduledNote[] = [];
    advancePlayhead({
      segments,
      segmentSettings,
      tiles,
      startTime: 0,
      beatSec,
      windowEnd: 10,
      emit: note => emitted.push(note),
    });
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({ midi: 60, when: 0 });
    // hold=2, beatSec=0.5 → duration = 0.5 * 2 * 0.95 = 0.95
    expect(emitted[0].duration).toBeCloseTo(0.95, 5);
  });
});

describe('advancePlayhead — solid chord mode (M11)', () => {
  it('solid chord fires all segment notes at the same beat', () => {
    const tiles = { a:n('a',0,0,60), b:n('b',1,0,64), c:n('c',2,0,67) };
    const byCell = { '0,0':'a','1,0':'b','2,0':'c' };
    const segs = computeSegments('a', tiles, byCell);
    const settings = { a: { segmentRootId:'a', mode:'solid' as const, holdBeats: 2 as const } };

    const events: any[] = [];
    advancePlayhead({
      segments: segs, segmentSettings: settings, tiles,
      startTime: 0, beatSec: 0.5, windowEnd: 10,
      emit: e => events.push(e),
    });
    expect(events.map(e => [e.midi, e.when]).sort()).toEqual([
      [60, 0], [64, 0], [67, 0]
    ]);
    for (const e of events) expect(e.duration).toBeCloseTo(0.95 * 1.0, 3);  // hold=2, beatSec=0.5 → 0.95
  });
});

describe('advancePlayhead — bass mode (M12)', () => {
  it('bass-flipped tile emits a sustained bass voice clamped to C2..B2', () => {
    // Single segment a,b,c. b is bass-flipped (pitch G5 = 79).
    const tiles = {
      a: n('a',0,0,60),
      b: { ...n('b',1,0,79), bass: true } as Tile,
      c: n('c',2,0,64),
    };
    const byCell = { '0,0':'a','1,0':'b','2,0':'c' };
    const segs = computeSegments('a', tiles, byCell);
    const events: any[] = [];
    advancePlayhead({
      segments: segs, segmentSettings: {}, tiles,
      startTime: 0, beatSec: 0.5, windowEnd: 10, emit: e => events.push(e),
    });

    // Expected:
    // beat 0: melody a=60
    // beat 1: melody b=79 + bass G2=43 starts (sustained)
    // beat 2: melody c=64
    // bass closes at end of segment (beat 3) → duration 2 beats * 0.5 * 0.95 = 0.95
    const bass = events.find(e => e.midi === 43);
    expect(bass).toBeTruthy();
    expect(bass!.when).toBeCloseTo(0.5, 3);
    expect(bass!.duration).toBeCloseTo(2 * 0.5 * 0.95, 3);

    // Melody pitches still present
    expect(events.some(e => e.midi === 60)).toBe(true);
    expect(events.some(e => e.midi === 79)).toBe(true);
    expect(events.some(e => e.midi === 64)).toBe(true);
  });
});

describe('advancePlayhead — branching at intersection (M10)', () => {
  it('forks playheads at an intersection: both branches fire phase-locked', () => {
    // a-b-c with intersection at c, branches d (south) and e (north)
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
      segments: segs,
      segmentSettings: {},
      tiles,
      startTime: 0,
      beatSec: 0.5,
      windowEnd: 10,
      emit: note => emitted.push(note),
    });

    // beat 0 → pitch 60 (a), beat 1 → pitch 62 (b), beat 2 → pitch 64 (c)
    // beat 3 → pitches 65 (d) and 67 (e) — both fork branches fire
    const atBeat = (beat: number) =>
      emitted.filter(e => Math.abs(e.when - beat * 0.5) < 1e-9).map(e => e.midi).sort((x, y) => x - y);

    expect(atBeat(0)).toEqual([60]);
    expect(atBeat(1)).toEqual([62]);
    expect(atBeat(2)).toEqual([64]);
    expect(atBeat(3)).toEqual([65, 67]);
    expect(emitted).toHaveLength(5);
  });
});
