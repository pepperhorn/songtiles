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
  onEnd?: () => void;
}

export interface Scheduler {
  start(): void;
  stop(): void;
}

export function createScheduler({ now, emit, getSnapshot, onEnd }: SchedulerOptions): Scheduler {
  let timerId: ReturnType<typeof setInterval> | null = null;
  let startTime = 0;
  let maxWhen = 0;          // latest event end-time we've scheduled
  let endFired = false;
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
      const end = n.when + (n.duration || 0);
      if (end > maxWhen) maxWhen = end;
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

    // End-of-pass detection: after we've scheduled at least one event AND
    // the audio clock has moved past the last event's tail, fire onEnd once.
    if (!endFired && maxWhen > 0 && currentTime > maxWhen + 0.05) {
      endFired = true;
      onEnd?.();
    }
  }

  return {
    start() {
      if (timerId !== null) return;
      startTime = now();          // captured once; subsequent ticks share this anchor
      emitted.clear();
      maxWhen = 0;
      endFired = false;
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
