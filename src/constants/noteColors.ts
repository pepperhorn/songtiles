export type PitchClass = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export const NOTE_COLORS_LIGHT: Record<PitchClass, string> = {
  'C': '#f86e6e',
  'C#': '#f58841',
  'D': '#ffbc57',
  'D#': '#b8a334',
  'E': '#fff56d',
  'F': '#b3f888',
  'F#': '#93d154',
  'G': '#6bc6a0',
  'G#': '#7ee8df',
  'A': '#88a7f8',
  'A#': '#cc97e8',
  'B': '#e277b1',
};

export const NOTE_COLORS_DARK: Record<PitchClass, string> = {
  'C': '#ed4e4e',
  'C#': '#e87428',
  'D': '#f5aa38',
  'D#': '#9c8b34',
  'E': '#f6ea4b',
  'F': '#99ee64',
  'F#': '#81c240',
  'G': '#56b68e',
  'G#': '#60dbd0',
  'A': '#648aee',
  'A#': '#b877da',
  'B': '#d45c9d',
};

export function midiToPitchClass(midi: number): PitchClass {
  const pitchClasses: PitchClass[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return pitchClasses[midi % 12];
}

export function midiToOctave(midi: number): number {
  return Math.floor(midi / 12) - 1;
}
