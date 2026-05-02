import type { Segment } from '../graph/segments';
import type { Tile, TileId, SegmentSettings } from '../graph/types';
import type { ScheduleEmit } from './events';

interface Args {
  segments: Segment[];
  segmentSettings: Record<TileId, SegmentSettings>;
  tiles: Record<TileId, Tile>;
  startTime: number;     // audio context time of beat 0
  beatSec: number;
  windowEnd: number;     // emit no event with `when` >= this
  emit: ScheduleEmit;
}

export function advancePlayhead({ segments, segmentSettings, tiles, startTime, beatSec, windowEnd, emit }: Args) {
  if (segments.length === 0) return;
  const seg = segments[0];
  const mode = segmentSettings[seg.rootId]?.mode ?? 'sequential';
  if (mode !== 'sequential') return;

  for (let i = 0; i < seg.tiles.length; i++) {
    const t = tiles[seg.tiles[i]];
    if (t.kind !== 'note') continue;
    const when = startTime + i * beatSec;
    if (when >= windowEnd) return;
    emit({ midi: t.pitch, when, duration: beatSec * 0.95, velocity: 0.8 });
  }
}
