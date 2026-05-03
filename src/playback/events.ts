import type { TileId } from '../graph/types';

export interface ScheduledNote {
  midi: number;
  when: number;       // absolute audio context time (seconds)
  duration: number;   // seconds
  velocity: number;   // 0..1
  tileId?: TileId;    // the tile that produced this event (for UI playhead indicator)
}
export type ScheduleEmit = (n: ScheduledNote) => void;
