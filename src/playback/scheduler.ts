import type { Segment } from '../graph/segments';
import type { Tile, TileId, Paint, PaintId } from '../graph/types';
import type { ScheduledNote, ScheduleEmit } from './events';
import { advancePlayhead } from './playhead';

const LOOKAHEAD_SEC = 2.0;
const TICK_MS = 25;

export interface SchedulerSnapshot {
  segments: Segment[];
  tiles: Record<TileId, Tile>;
  paints: Record<PaintId, Paint>;
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
  let startTime = 0;
  const emitted = new Set<string>();

  function tick() {
    const currentTime = now();
    const windowEnd = currentTime + LOOKAHEAD_SEC;
    const snapshot = getSnapshot();
    const beatSec = 60 / snapshot.bpm;

    const wrappedEmit: ScheduleEmit = (n: ScheduledNote) => {
      const key = `${n.midi}@${n.when.toFixed(4)}`;
      if (emitted.has(key)) return;
      emitted.add(key);
      emit(n);
    };

    advancePlayhead({
      segments: snapshot.segments,
      tiles: snapshot.tiles,
      paints: snapshot.paints,
      startTime,
      beatSec,
      windowEnd,
      emit: wrappedEmit,
    });
  }

  return {
    start() {
      if (timerId !== null) return;
      startTime = now();          // captured once; subsequent ticks share this anchor
      emitted.clear();
      tick();                     // immediate first tick
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
