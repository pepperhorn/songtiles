export interface ScheduledNote {
  midi: number;
  when: number;       // absolute audio context time (seconds)
  duration: number;   // seconds
  velocity: number;   // 0..1
}
export type ScheduleEmit = (n: ScheduledNote) => void;
