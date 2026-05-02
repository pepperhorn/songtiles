import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createScheduler } from '../../src/playback/scheduler';
import type { ScheduledNote } from '../../src/playback/events';
import type { Tile, TileId } from '../../src/graph/types';
import type { Segment } from '../../src/graph/segments';

describe('createScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits exactly 1 note for a single-tile segment within 200ms', () => {
    const tiles: Record<TileId, Tile> = {
      t1: { id: 't1', kind: 'note', pitch: 60, bass: false, cell: { x: 0, y: 0 } },
    };
    const segments: Segment[] = [
      { rootId: 't1', tiles: ['t1'], endsAtIntersection: false },
    ];

    const emitted: ScheduledNote[] = [];
    let fakeTime = 0;

    const scheduler = createScheduler({
      now: () => fakeTime,
      emit: n => emitted.push(n),
      getSnapshot: () => ({
        segments,
        segmentSettings: {},
        tiles,
        bpm: 120,
      }),
    });

    scheduler.start();
    vi.advanceTimersByTime(200);
    scheduler.stop();

    // Exactly 1 note at midi 60 — deduplication prevents re-emit on subsequent ticks
    expect(emitted).toHaveLength(1);
    expect(emitted[0].midi).toBe(60);
  });

  it('deduplicates notes across ticks', () => {
    const tiles: Record<TileId, Tile> = {
      t1: { id: 't1', kind: 'note', pitch: 72, bass: false, cell: { x: 0, y: 0 } },
    };
    const segments: Segment[] = [
      { rootId: 't1', tiles: ['t1'], endsAtIntersection: false },
    ];

    const emitted: ScheduledNote[] = [];
    let fakeTime = 0;

    const scheduler = createScheduler({
      now: () => fakeTime,
      emit: n => emitted.push(n),
      getSnapshot: () => ({ segments, segmentSettings: {}, tiles, bpm: 60 }),
    });

    scheduler.start();
    // Advance through many ticks — same note should only emit once
    vi.advanceTimersByTime(500);
    scheduler.stop();

    const midi72 = emitted.filter(n => n.midi === 72);
    expect(midi72).toHaveLength(1);
  });

  it('does not emit after stop()', () => {
    const tiles: Record<TileId, Tile> = {
      t1: { id: 't1', kind: 'note', pitch: 60, bass: false, cell: { x: 0, y: 0 } },
    };
    const segments: Segment[] = [
      { rootId: 't1', tiles: ['t1'], endsAtIntersection: false },
    ];

    const emitted: ScheduledNote[] = [];
    let fakeTime = 0;

    const scheduler = createScheduler({
      now: () => fakeTime,
      emit: n => emitted.push(n),
      getSnapshot: () => ({ segments, segmentSettings: {}, tiles, bpm: 120 }),
    });

    scheduler.start();
    scheduler.stop();
    vi.advanceTimersByTime(500);

    // Only the immediate first tick before stop may have fired
    const countAfterStop = emitted.length;
    vi.advanceTimersByTime(500);
    expect(emitted.length).toBe(countAfterStop);
  });
});
