import type { AppState } from './store';
import type { Tile, TileId, SegmentSettings } from '../graph/types';
import type { TrayCapacity, RepeatPoolSize } from '../graph/types';

export interface SessionFile {
  version: 1;
  savedAt: string;
  bpm: number;
  patchId: string;
  trayCapacity: TrayCapacity;
  repeatPoolSize: RepeatPoolSize;
  repeatSetsRemaining: number;
  startTileId: TileId | null;
  tiles: Record<TileId, Tile>;
  placements: { canvas: TileId[]; tray: TileId[]; deck: TileId[] };
  discardedCount: number;
  segmentSettings: Record<TileId, SegmentSettings>;
}

type Serialisable = Pick<AppState,
  'tiles'|'startTileId'|'tray'|'deck'|'discardedCount'
  |'trayCapacity'|'repeatPoolSize'|'repeatSetsRemaining'
  |'bpm'|'patchId'|'segmentSettings'>;

export function serialiseSession(s: Serialisable): string {
  const canvas = Object.values(s.tiles).filter(t => t.cell).map(t => t.id);
  const file: SessionFile = {
    version: 1, savedAt: new Date().toISOString(),
    bpm: s.bpm, patchId: s.patchId,
    trayCapacity: s.trayCapacity, repeatPoolSize: s.repeatPoolSize,
    repeatSetsRemaining: s.repeatSetsRemaining,
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
  if (f?.version !== 1) throw new Error('Unsupported session version');
  // Invariant: note tiles in tiles + discardedCount should not exceed 144.
  const noteTiles = Object.values(f.tiles).filter(t => t.kind === 'note');
  if (noteTiles.length + f.discardedCount > 144) {
    throw new Error('Invariant violated: note tile total exceeds 144');
  }
  // Rebuild byCell from tiles[].cell.
  const byCell: Record<string, TileId> = {};
  for (const t of Object.values(f.tiles)) {
    if (t.cell) byCell[`${t.cell.x},${t.cell.y}`] = t.id;
  }
  return Object.assign(f, { byCell });
}
