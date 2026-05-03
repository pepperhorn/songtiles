import type { Segment } from '../graph/segments';
import type { Tile, TileId, Paint, PaintId } from '../graph/types';
import type { ScheduleEmit } from './events';
import { findRepeatSpans } from '../graph/repeats';

interface Args {
  segments: Segment[];
  tiles: Record<TileId, Tile>;
  paints: Record<PaintId, Paint>;
  startTime: number;     // audio context time of beat 0
  beatSec: number;
  windowEnd: number;     // emit no event with `when` >= this
  emit: ScheduleEmit;
}

/**
 * Walk the segment graph in beat-time and emit scheduled notes.
 *
 * Default behaviour is one note per tile per beat (sequential) with bass
 * voice for any tile flagged `bass`. Paints layer on top:
 *
 *   - Chord paint: when the playhead first hits any tile in the paint, all N
 *     tiles fire simultaneously at that beat with duration = N * beatSec.
 *   - Arp paint: when first hit, schedule 2N pulses at half-tick intervals
 *     over N beats total — the cycle through the N tiles plays twice.
 *   - Both: a tile in both a chord paint and an arp paint triggers both
 *     behaviours simultaneously when first hit.
 *
 * Once a paint has fired in a pass, every tile in that paint is silenced
 * for the remainder of the pass — so subsequent encounters by branched
 * playheads don't re-trigger the same paint.
 */
export function advancePlayhead({ segments, tiles, paints, startTime, beatSec, windowEnd, emit }: Args) {
  if (segments.length === 0) return;

  // Index: tileId → list of paints that contain it.
  const paintsByTile = new Map<TileId, Paint[]>();
  for (const p of Object.values(paints)) {
    for (const t of p.tileIds) {
      const list = paintsByTile.get(t) ?? [];
      list.push(p);
      paintsByTile.set(t, list);
    }
  }

  // Mark each paint as fired-or-not for this pass.
  const firedPaints = new Set<PaintId>();
  // Tiles that have been silenced because they belong to a paint that already fired.
  const consumedTiles = new Set<TileId>();

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

  // Cycle guard: dense graphs (e.g. a row + column adjacent forming a 2xN
  // grid) produce cycles in the segment-children relation. Without this set,
  // BFS heads grow exponentially each tick and freeze the app.
  const visitedSegs = new Set<string>();

  while (heads.length) {
    const { seg, beat } = heads.shift()!;
    if (visitedSegs.has(seg.rootId)) continue;
    visitedSegs.add(seg.rootId);
    let beatsConsumed = 0;

    let activeBass: { midi: number; startBeat: number } | null = null;
    const closeBass = (endBeat: number) => {
      if (!activeBass) return;
      const dur = (endBeat - activeBass.startBeat) * beatSec;
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

    type PathItem = { id: string; kind: 'note' | 'repeat-open' | 'repeat-close'; count?: 1|2|3|4|'inf' };
    const path: PathItem[] = seg.tiles.map(id => {
      const t = tiles[id];
      if (t.kind === 'note') return { id, kind: 'note' as const };
      if (t.kind === 'repeat-open') return { id, kind: 'repeat-open' as const, count: t.count };
      return { id, kind: 'repeat-close' as const };
    });
    const spans = findRepeatSpans(path);

    // Fire one tile at the given beat offset. Returns the number of beats this
    // tile consumes (1 for a normal note, 1 for the lead tile of a chord/arp
    // paint — since the playhead still advances one tick on the canvas — but
    // the paint's audio effect spans N beats), or 0 for repeat tiles.
    const fireIndex = (i: number, beatOffset: number): { beats: number; aborted: boolean } => {
      const item = path[i];
      if (item.kind !== 'note') return { beats: 0, aborted: false };
      const t = tiles[item.id];
      if (t.kind !== 'note') return { beats: 0, aborted: false };
      const when = startTime + (beat + beatOffset) * beatSec;
      if (when >= windowEnd) return { beats: 0, aborted: true };

      // If the tile is already consumed by a paint that fired earlier, silence it.
      if (consumedTiles.has(item.id)) return { beats: 1, aborted: false };

      // Check paints containing this tile.
      const tilePaints = paintsByTile.get(item.id) ?? [];
      const unfired = tilePaints.filter(p => !firedPaints.has(p.id));

      if (unfired.length === 0) {
        // Plain sequential note.
        emit({ midi: t.pitch, when, duration: beatSec, velocity: 0.8, tileId: item.id });
        if (t.bass) {
          closeBass(beat + beatOffset);
          const pc = ((t.pitch % 12) + 12) % 12;
          activeBass = { midi: 36 + pc, startBeat: beat + beatOffset };
        }
        return { beats: 1, aborted: false };
      }

      // At least one paint will fire. Mark all paint tiles consumed.
      for (const p of unfired) {
        firedPaints.add(p.id);
        for (const tid of p.tileIds) consumedTiles.add(tid);
      }

      // Emit each paint's audio.
      for (const p of unfired) {
        const noteIds = p.tileIds.filter(id => tiles[id]?.kind === 'note');
        const noteTiles = noteIds.map(id => tiles[id]) as Array<Extract<Tile, { kind: 'note' }>>;
        if (noteTiles.length === 0) continue;
        const N = noteTiles.length;
        if (p.kind === 'chord') {
          // All notes fire at `when` with duration = N * beatSec (so the chord
          // sustains for as many ticks as it has notes).
          const dur = N * beatSec;
          for (const nt of noteTiles) {
            emit({ midi: nt.pitch, when, duration: dur, velocity: 0.8, tileId: nt.id });
          }
        } else if (p.kind === 'arp') {
          // 2N pulses over N beats: each pulse 0.5 * beatSec; cycle through
          // notes twice. Pulse k → noteTiles[k % N].
          const pulseSec = beatSec / 2;
          const totalPulses = 2 * N;
          for (let k = 0; k < totalPulses; k++) {
            const nt = noteTiles[k % N];
            emit({
              midi: nt.pitch,
              when: when + k * pulseSec,
              duration: pulseSec,
              velocity: 0.8,
              tileId: nt.id,
            });
          }
        }
      }

      return { beats: 1, aborted: false };
    };

    let b = 0;

    // Look up a sibling segment by its root tile id (branches off mid-section
    // intersections store tile ids of branch roots; the BFS queue takes Segment
    // refs).
    const segByRoot = new Map<TileId, Segment>();
    for (const s of segments) segByRoot.set(s.rootId, s);

    // Queue mid-section branches for the given intersection tile, if any.
    // Only called on the final pass through the repeat span.
    const queueBranches = (tileId: TileId, atBeat: number) => {
      const branches = seg.branchesByTile?.[tileId];
      if (!branches) return;
      for (const branchRoot of branches) {
        const child = segByRoot.get(branchRoot);
        if (child) heads.push({ seg: child, beat: atBeat });
      }
    };

    const fireRange = (
      from: number, to: number, beatStart: number,
      allowBranches: boolean,
    ): { beatsAdded: number; aborted: boolean } => {
      let localB = beatStart;
      let i = from;
      while (i < to) {
        const span = spans.find(s => s.openIndex === i && s.closeIndex < to);
        if (span) {
          const reps = span.count === 'inf' ? 1 : span.count;
          for (let r = 0; r < reps; r++) {
            const isLast = r === reps - 1;
            const inner = fireRange(span.openIndex + 1, span.closeIndex, localB, isLast);
            if (inner.aborted) return { beatsAdded: localB - beatStart + inner.beatsAdded, aborted: true };
            localB += inner.beatsAdded;
          }
          i = span.closeIndex + 1;
          continue;
        }
        const tileBeat = localB;
        const res = fireIndex(i, localB);
        if (res.aborted) { closeBass(beat + localB); return { beatsAdded: localB - beatStart, aborted: true }; }
        // Fork mid-section branches off this tile only on the final loop pass.
        if (allowBranches && res.beats > 0) {
          queueBranches(path[i].id, beat + tileBeat + res.beats);
        }
        localB += res.beats;
        i++;
      }
      return { beatsAdded: localB - beatStart, aborted: false };
    };

    const result = fireRange(0, path.length, 0, true);
    if (!result.aborted) {
      b = result.beatsAdded;
      closeBass(beat + b);
    }
    beatsConsumed = b;

    if (seg.endsAtIntersection) {
      const childBeat = beat + beatsConsumed;
      for (const c of childrenOf(seg)) heads.push({ seg: c, beat: childBeat });
    }
  }
}
