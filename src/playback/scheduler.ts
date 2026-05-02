import type { Segment } from '../graph/segments';
import type { Tile, TileId, SegmentSettings } from '../graph/types';
import type { ScheduledNote, ScheduleEmit } from './events';
import { advancePlayhead } from './playhead';

const LOOKAHEAD_SEC = 2.0;
const TICK_MS = 25;

export interface SchedulerSnapshot {
  segments: Segment[];
  segmentSettings: Record<TileId, SegmentSettings>;
  tiles: Record<TileId, Tile>;
  bpm: number;
}

export interface SchedulerOptions {
  now: () => number;
  emit: ScheduleEmit;
  getSnapshot: () => SchedulerSnapshot;
}

export interface Scheduler {
  start(): void;
  stop(): void;
}

export function createScheduler({ now, emit, getSnapshot }: SchedulerOptions): Scheduler {
  let timerId: ReturnType<typeof setInterval> | null = null;
  const emitted = new Set<string>();

  function tick() {
    const currentTime = now();
    const windowEnd = currentTime + LOOKAHEAD_SEC;
    const snapshot = getSnapshot();
    const beatSec = 60 / snapshot.bpm;

    // We schedule from currentTime as startTime so notes are relative to now
    // Dedupe via (midi, when) key
    const wrappedEmit: ScheduleEmit = (n: ScheduledNote) => {
      const key = `${n.midi}@${n.when.toFixed(4)}`;
      if (emitted.has(key)) return;
      emitted.add(key);
      emit(n);
    };

    advancePlayhead({
      segments: snapshot.segments,
      segmentSettings: snapshot.segmentSettings,
      tiles: snapshot.tiles,
      startTime: currentTime,
      beatSec,
      windowEnd,
      emit: wrappedEmit,
    });
  }

  return {
    start() {
      if (timerId !== null) return;
      tick(); // immediate first tick
      timerId = setInterval(tick, TICK_MS);
    },

    stop() {
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
      emitted.clear();
    },
  };
}
