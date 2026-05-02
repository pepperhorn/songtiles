export type Cell = { x: number; y: number };
export type TileId = string;
export type Pitch = number; // MIDI 36..84

export interface TileBase { id: TileId; cell: Cell | null }  // null = in tray / deck
export interface NoteTile  extends TileBase { kind: 'note';  pitch: Pitch; bass: boolean }
export interface RepeatOpenTile  extends TileBase { kind: 'repeat-open';  count: 1|2|3|4|'inf' }
export interface RepeatCloseTile extends TileBase { kind: 'repeat-close' }
export type Tile = NoteTile | RepeatOpenTile | RepeatCloseTile;

export type SegmentMode = 'sequential' | 'solid' | 'arp';
export interface SegmentSettings {
  segmentRootId: TileId;
  mode: SegmentMode;
  holdBeats: 1|2|3|4;
}

export type TrayCapacity = 4|6|8|9|10|11|12;
export type RepeatPoolSize = 3|5|8|12;

export const cellKey = (c: Cell) => `${c.x},${c.y}`;
