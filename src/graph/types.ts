export type Cell = { x: number; y: number };
export type TileId = string;
export type Pitch = number; // MIDI 36..84

export interface TileBase { id: TileId; cell: Cell | null }  // null = in tray / deck
export interface NoteTile    extends TileBase { kind: 'note'; pitch: Pitch; bass: boolean }
/** Single repeat-marker tile. Two repeat tiles on the same row/column with
 *  notes between them auto-pair into a section that loops `count` times. A
 *  lone repeat is a no-op for playback (just a placeholder). */
export interface RepeatTile  extends TileBase { kind: 'repeat'; count: 1|2|3|4|'inf' }
export type Tile = NoteTile | RepeatTile;

export type SegmentMode = 'sequential' | 'solid' | 'arp';
export interface SegmentSettings {
  segmentRootId: TileId;
  mode: SegmentMode;
  holdBeats: 1|2|3|4;
}

export type TrayCapacity = 6|8|12;
/** Wildness ladder. Percentages are applied to the note-tile count to
 *  decide how many wildcard tiles to mix into the deck:
 *    tame   ≈  5%   (≈ 7 wildcards on a 144-note explorer deck)
 *    wild   ≈ 10%   (≈ 14)
 *    wilder ≈ 15%   (≈ 22)
 */
export type Wildness = 'tame' | 'wild' | 'wilder';
export const WILDNESS_RATIO: Record<Wildness, number> = { tame: 0.05, wild: 0.10, wilder: 0.15 };

export type GameMode = 'explorer' | 'scale';
export type ScaleType = 'major' | 'minor';
/** Pitch class 0..11 (0 = C, 1 = C#, ..., 11 = B). */
export type ScaleRoot = 0|1|2|3|4|5|6|7|8|9|10|11;

/** Scale-degree intervals (semitone offsets from root). */
export const SCALE_INTERVALS: Record<ScaleType, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

export type PaintId = string;
export type PaintKind = 'chord' | 'arp';
export interface Paint {
  id: PaintId;
  kind: PaintKind;
  tileIds: TileId[];   // 2+ tiles, may be disconnected on the canvas
}
export type PaintTool = 'chord' | 'arp' | 'bass' | 'eraser' | null;

export const cellKey = (c: Cell) => `${c.x},${c.y}`;
