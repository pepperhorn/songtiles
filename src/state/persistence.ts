import type { AppState } from './store';
import type {
  Tile, TileId, SegmentSettings, TrayCapacity, Wildness,
  GameMode, ScaleRoot, ScaleType,
} from '../graph/types';

export interface SessionFile {
  version: 2;
  savedAt: string;
  bpm: number;
  patchId: string;
  trayCapacity: TrayCapacity;
  wildness: Wildness;
  gameMode: GameMode;
  scaleRoot: ScaleRoot;
  scaleType: ScaleType;
  startTileId: TileId | null;
  tiles: Record<TileId, Tile>;
  placements: { canvas: TileId[]; tray: TileId[]; deck: TileId[] };
  discardedCount: number;
  segmentSettings: Record<TileId, SegmentSettings>;
}

type Serialisable = Pick<AppState,
  'tiles'|'startTileId'|'tray'|'deck'|'discardedCount'
  |'trayCapacity'|'wildness'|'gameMode'|'scaleRoot'|'scaleType'
  |'bpm'|'patchId'|'segmentSettings'>;

export function serialiseSession(s: Serialisable): string {
  const canvas = Object.values(s.tiles).filter(t => t.cell).map(t => t.id);
  const file: SessionFile = {
    version: 2, savedAt: new Date().toISOString(),
    bpm: s.bpm, patchId: s.patchId,
    trayCapacity: s.trayCapacity,
    wildness: s.wildness,
    gameMode: s.gameMode,
    scaleRoot: s.scaleRoot,
    scaleType: s.scaleType,
    startTileId: s.startTileId,
    tiles: s.tiles,
    placements: { canvas, tray: s.tray, deck: s.deck },
    discardedCount: s.discardedCount,
    segmentSettings: s.segmentSettings,
  };
  return JSON.stringify(file, null, 2);
}

export function deserialiseSession(raw: unknown): SessionFile & { byCell: Record<string, TileId> } {
  const f = raw as SessionFile;
  if (f?.version !== 2) throw new Error('Unsupported session version');
  // Rebuild byCell from tiles[].cell.
  const byCell: Record<string, TileId> = {};
  for (const t of Object.values(f.tiles)) {
    if (t.cell) byCell[`${t.cell.x},${t.cell.y}`] = t.id;
  }
  return Object.assign(f, { byCell });
}
