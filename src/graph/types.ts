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

export type TrayCapacity = 4|6|8|9|10|11|12;
export type RepeatPoolSize = 3|5|8|12;

export type PaintId = string;
export type PaintKind = 'chord' | 'arp';
export interface Paint {
  id: PaintId;
  kind: PaintKind;
  tileIds: TileId[];   // 2+ tiles, may be disconnected on the canvas
}
export type PaintTool = 'chord' | 'arp' | 'bass' | 'eraser' | null;

export const cellKey = (c: Cell) => `${c.x},${c.y}`;
