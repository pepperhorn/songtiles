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

  it('skips non-sequential modes', () => {
    const beatSec = 0.5;
    const tiles: Record<TileId, Tile> = {
      t1: { id: 't1', kind: 'note', pitch: 60, bass: false, cell: { x: 0, y: 0 } },
    };
    const segments: Segment[] = [
      { rootId: 't1', tiles: ['t1'], endsAtIntersection: false },
    ];
    const segmentSettings: Record<TileId, SegmentSettings> = {
      t1: { segmentRootId: 't1', mode: 'solid', holdBeats: 1 },
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
    expect(emitted).toHaveLength(0);
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
