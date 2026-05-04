import type { Tile, TileId } from '../graph/types';
import type { ScheduledNote } from '../playback/events';

export type GroupTypeId = string;
export type GroupId = string;

/** Persisted group instance — references a registered GroupType by id. */
export interface Group {
  id: GroupId;
  typeId: GroupTypeId;
  tileIds: TileId[];
}

/** Context passed to GroupType.onFire when the playhead first hits a tile in the group. */
export interface GroupFireContext {
  group: Group;
  tiles: Record<TileId, Tile>;
  /** Audio-context time the playhead reached the triggering tile. */
  when: number;
  /** Seconds per beat at the current bpm. */
  beatSec: number;
  emit: (note: ScheduledNote) => void;
}

/** A registered group type. Defines visual, toolbar, and audio behavior for a Group. */
export interface GroupType {
  id: GroupTypeId;
  label: string;
  icon: string;
  /** Highlight tint for tiles in groups of this type. */
  color: string;
  /** Called once per pass when the playhead first hits any tile in the group. */
  onFire(ctx: GroupFireContext): void;
}
