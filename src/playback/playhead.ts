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

  // tilesAreAdjacent helper to identify which child segments belong to which intersection.
  const adj = (a?: Tile, b?: Tile) => {
    if (!a?.cell || !b?.cell) return false;
    return Math.abs(a.cell.x - b.cell.x) + Math.abs(a.cell.y - b.cell.y) === 1;
  };
  const childrenOf = (parent: Segment): Segment[] => {
    if (!parent.endsAtIntersection) return [];
    const last = parent.tiles[parent.tiles.length - 1];
    return segments.filter(s => s.rootId !== parent.rootId && adj(tiles[last], tiles[s.rootId]));
  };

  const startSeg = segments[0];
  const heads: Array<{ seg: Segment; beat: number }> = [{ seg: startSeg, beat: 0 }];

  while (heads.length) {
    const { seg, beat } = heads.shift()!;
    const settings = segmentSettings[seg.rootId];
    const mode = settings?.mode ?? 'sequential';
    const hold = settings?.holdBeats ?? 1;
    let beatsConsumed = 0;

    if (mode === 'sequential') {
      let activeBass: { midi: number; startBeat: number } | null = null;
      const closeBass = (endBeat: number) => {
        if (!activeBass) return;
        const dur = (endBeat - activeBass.startBeat) * beatSec * 0.95;
        if (dur > 0) {
          emit({
            midi: activeBass.midi,
            when: startTime + activeBass.startBeat * beatSec,
            duration: dur,
            velocity: 0.7,
          });
        }
        activeBass = null;
      };

      for (let i = 0; i < seg.tiles.length; i++) {
        const t = tiles[seg.tiles[i]];
        if (t.kind !== 'note') continue;
        const when = startTime + (beat + i) * beatSec;
        if (when >= windowEnd) { closeBass(beat + i); return; }
        emit({ midi: t.pitch, when, duration: beatSec * 0.95, velocity: 0.8 });

        if (t.bass) {
          closeBass(beat + i);                  // close prior bass at this tile
          const pc = ((t.pitch % 12) + 12) % 12;
          activeBass = { midi: 36 + pc, startBeat: beat + i }; // clamp to C2..B2
        }
      }
      closeBass(beat + seg.tiles.length);
      beatsConsumed = seg.tiles.length;
    } else {
      // solid or arp
      const noteTiles = seg.tiles.map(id => tiles[id]).filter(t => t.kind === 'note') as Extract<Tile, { kind: 'note' }>[];
      const baseWhen = startTime + beat * beatSec;
      if (baseWhen >= windowEnd) return;
      const arpStep = mode === 'arp' ? Math.min(0.04, beatSec / Math.max(noteTiles.length, 1)) : 0;
      noteTiles.forEach((t, i) => {
        emit({
          midi: t.pitch,
          when: baseWhen + i * arpStep,
          duration: beatSec * hold * 0.95,
          velocity: 0.8,
        });
      });
      const firstBassTile = noteTiles.find(t => t.bass);
      if (firstBassTile) {
        const pc = ((firstBassTile.pitch % 12) + 12) % 12;
        emit({
          midi: 36 + pc,
          when: baseWhen,
          duration: beatSec * hold * 0.95,
          velocity: 0.7,
        });
      }
      beatsConsumed = hold;
    }

    if (seg.endsAtIntersection) {
      const childBeat = beat + beatsConsumed;
      for (const c of childrenOf(seg)) heads.push({ seg: c, beat: childBeat });
    }
  }
}
