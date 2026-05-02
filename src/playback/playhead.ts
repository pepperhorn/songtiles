import type { Segment } from '../graph/segments';
import type { Tile, TileId, SegmentSettings } from '../graph/types';
import type { ScheduleEmit } from './events';
import { findRepeatSpans } from '../graph/repeats';

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

      // Build path items for repeat expansion
      type PathItem = { id: string; kind: 'note' | 'repeat-open' | 'repeat-close'; count?: 1|2|3|4|'inf' };
      const path: PathItem[] = seg.tiles.map(id => {
        const t = tiles[id];
        if (t.kind === 'note') return { id, kind: 'note' as const };
        if (t.kind === 'repeat-open') return { id, kind: 'repeat-open' as const, count: t.count };
        return { id, kind: 'repeat-close' as const };
      });
      const spans = findRepeatSpans(path);

      let b = 0;

      // Fire a single note tile at beat offset `beatOffset`, return beats consumed (0 or 1)
      // Returns aborted=true if windowEnd reached
      const fireIndex = (i: number, beatOffset: number): { beats: number; aborted: boolean } => {
        const item = path[i];
        if (item.kind !== 'note') return { beats: 0, aborted: false };
        const t = tiles[item.id];
        if (t.kind !== 'note') return { beats: 0, aborted: false };
        const when = startTime + (beat + beatOffset) * beatSec;
        if (when >= windowEnd) return { beats: 0, aborted: true };
        emit({ midi: t.pitch, when, duration: beatSec * 0.95, velocity: 0.8 });

        if (t.bass) {
          closeBass(beat + beatOffset);
          const pc = ((t.pitch % 12) + 12) % 12;
          activeBass = { midi: 36 + pc, startBeat: beat + beatOffset };
        }
        return { beats: 1, aborted: false };
      };

      // Recursive helper: fire indices in [from, to) range, expanding spans within.
      // Returns { beatsAdded, aborted }
      const fireRange = (from: number, to: number, beatStart: number): { beatsAdded: number; aborted: boolean } => {
        let localB = beatStart;
        let i = from;
        while (i < to) {
          const span = spans.find(s => s.openIndex === i && s.closeIndex < to);
          if (span) {
            // Expand this span
            const reps = span.count === 'inf' ? 1 : span.count;
            for (let r = 0; r < reps; r++) {
              const inner = fireRange(span.openIndex + 1, span.closeIndex, localB);
              if (inner.aborted) return { beatsAdded: localB - beatStart + inner.beatsAdded, aborted: true };
              localB += inner.beatsAdded;
            }
            i = span.closeIndex + 1;
            continue;
          }
          // Non-span item (or repeat-open/close without a matching span within range)
          const res = fireIndex(i, localB);
          if (res.aborted) { closeBass(beat + localB); return { beatsAdded: localB - beatStart, aborted: true }; }
          localB += res.beats;
          i++;
        }
        return { beatsAdded: localB - beatStart, aborted: false };
      };

      const result = fireRange(0, path.length, 0);
      if (!result.aborted) {
        b = result.beatsAdded;
        closeBass(beat + b);
      }
      beatsConsumed = b;
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
