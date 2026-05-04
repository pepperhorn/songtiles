import type { AppState } from './store';
import type {
  Tile, TileId, SegmentSettings, TrayCapacity, Wildness,
  GameMode,
} from '../graph/types';

export interface SessionFile {
  version: 3;
  savedAt: string;
  bpm: number;
  patchId: string;
  trayCapacity: TrayCapacity;
  wildness: Wildness;
  gameMode: GameMode;
  /** Mode-specific params, shape defined by the registered GameMode. */
  gameParams: unknown;
  startTileId: TileId | null;
  tiles: Record<TileId, Tile>;
  placements: { canvas: TileId[]; tray: TileId[]; deck: TileId[] };
  discardedCount: number;
  segmentSettings: Record<TileId, SegmentSettings>;
}

/** Legacy v2 shape — needed only for read back-compat. */
interface LegacySessionFileV2 {
  version: 2;
  bpm: number; patchId: string;
  trayCapacity: TrayCapacity; wildness: Wildness;
  gameMode: GameMode;
  scaleRoot?: number; scaleType?: 'major' | 'minor';
  startTileId: TileId | null;
  tiles: Record<TileId, Tile>;
  placements: { canvas: TileId[]; tray: TileId[]; deck: TileId[] };
  discardedCount: number;
  segmentSettings: Record<TileId, SegmentSettings>;
  savedAt: string;
}

type Serialisable = Pick<AppState,
  'tiles'|'startTileId'|'tray'|'deck'|'discardedCount'
  |'trayCapacity'|'wildness'|'gameMode'|'gameParams'
  |'bpm'|'patchId'|'segmentSettings'>;

export function serialiseSession(s: Serialisable): string {
  const canvas = Object.values(s.tiles).filter(t => t.cell).map(t => t.id);
  const file: SessionFile = {
    version: 3, savedAt: new Date().toISOString(),
    bpm: s.bpm, patchId: s.patchId,
    trayCapacity: s.trayCapacity,
    wildness: s.wildness,
    gameMode: s.gameMode,
    gameParams: s.gameParams,
    startTileId: s.startTileId,
    tiles: s.tiles,
    placements: { canvas, tray: s.tray, deck: s.deck },
    discardedCount: s.discardedCount,
    segmentSettings: s.segmentSettings,
  };
  return JSON.stringify(file, null, 2);
}

export function deserialiseSession(raw: unknown): SessionFile & { byCell: Record<string, TileId> } {
  const f = raw as SessionFile | LegacySessionFileV2;
  let upgraded: SessionFile;
  if (f?.version === 3) {
    upgraded = f;
  } else if (f?.version === 2) {
    // Legacy: synthesise gameParams from scaleRoot/scaleType if present.
    const legacy = f as LegacySessionFileV2;
    const gameParams: unknown = legacy.gameMode === 'scale'
      ? { root: legacy.scaleRoot ?? 0, type: legacy.scaleType ?? 'major' }
      : {};
    upgraded = { ...legacy, version: 3, gameParams };
  } else {
    throw new Error('Unsupported session version');
  }
  // Rebuild byCell from tiles[].cell.
  const byCell: Record<string, TileId> = {};
  for (const t of Object.values(upgraded.tiles)) {
    if (t.cell) byCell[`${t.cell.x},${t.cell.y}`] = t.id;
  }
  return Object.assign(upgraded, { byCell });
}
