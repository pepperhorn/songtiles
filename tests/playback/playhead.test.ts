import { describe, it, expect } from 'vitest';
import { advancePlayhead } from '../../src/playback/playhead';
import type { ScheduledNote } from '../../src/playback/events';
import type { Segment } from '../../src/graph/segments';
import type { Tile, TileId, SegmentSettings } from '../../src/graph/types';

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
      emit: n => emitted.push(n),
    });
    expect(emitted).toHaveLength(0);
  });
});
