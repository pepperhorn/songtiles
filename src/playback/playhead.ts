import type { Segment } from '../graph/segments';
import type { Tile, TileId } from '../graph/types';
import type { Group, GroupId } from '../groups/types';
import { getGroupType } from '../groups/registry';
import type { ScheduleEmit } from './events';

interface Args {
  segments: Segment[];
  tiles: Record<TileId, Tile>;
  groups: Record<GroupId, Group>;
  startTime: number;     // audio context time of beat 0
  beatSec: number;
  windowEnd: number;     // emit no event with `when` >= this
  emit: ScheduleEmit;
}

/**
 * Walk the segment graph in beat-time and emit scheduled notes.
 *
 * Default behaviour is one note per tile per beat with bass voice for any tile
 * flagged `bass`. Groups layer on top: when the playhead first hits any tile
 * in a group, the group's registered GroupType.onFire emits the group's audio
 * (e.g. chord = stacked simultaneous notes; arp = pulse cycle). Once a group
 * has fired in a pass, every tile in that group is silenced for the remainder
 * of the pass — so subsequent encounters by branched playheads don't re-trigger.
 */
export function advancePlayhead({ segments, tiles, groups, startTime, beatSec, windowEnd, emit }: Args) {
  if (segments.length === 0) return;

  // Index: tileId → list of groups that contain it.
  const groupsByTile = new Map<TileId, Group[]>();
  for (const g of Object.values(groups)) {
    for (const t of g.tileIds) {
      const list = groupsByTile.get(t) ?? [];
      list.push(g);
      groupsByTile.set(t, list);
    }
  }

  // Mark each group as fired-or-not for this pass.
  const firedGroups = new Set<GroupId>();
  // Tiles silenced because they belong to a group that already fired.
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

    type PathItem = { id: string; kind: 'note' | 'repeat'; count?: 1|2|3|4|'inf' };
    const path: PathItem[] = seg.tiles.map(id => {
      const t = tiles[id];
      if (t.kind === 'note') return { id, kind: 'note' as const };
      return { id, kind: 'repeat' as const, count: t.count };
    });

    // Fire one tile at the given beat offset. Returns the number of beats this
    // tile consumes (1 for a normal note, 1 for the lead tile of a group — the
    // playhead still advances one tick on the canvas — but the group's audio
    // effect may span multiple beats), or 0 for repeat tiles.
    const fireIndex = (i: number, beatOffset: number): { beats: number; aborted: boolean } => {
      const item = path[i];
      if (item.kind !== 'note') return { beats: 0, aborted: false };
      const t = tiles[item.id];
      if (t.kind !== 'note') return { beats: 0, aborted: false };
      const when = startTime + (beat + beatOffset) * beatSec;
      if (when >= windowEnd) return { beats: 0, aborted: true };

      // If the tile is already consumed by a group that fired earlier, silence it.
      if (consumedTiles.has(item.id)) return { beats: 1, aborted: false };

      // Check groups containing this tile.
      const tileGroups = groupsByTile.get(item.id) ?? [];
      const unfired = tileGroups.filter(g => !firedGroups.has(g.id));

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

      // At least one group will fire. Mark all group tiles consumed.
      for (const g of unfired) {
        firedGroups.add(g.id);
        for (const tid of g.tileIds) consumedTiles.add(tid);
      }

      // Dispatch each group via its registered GroupType.
      for (const g of unfired) {
        const type = getGroupType(g.typeId);
        if (!type) continue; // unknown group type — silently skip
        type.onFire({ group: g, tiles, when, beatSec, emit });
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

    // Walk a contiguous chunk [from, to) firing each tile at incrementing
    // beats. Mid-section branches off intersection tiles only fork when
    // `allowBranches` is true (used to defer branching until a repeat's
    // count is satisfied).
    const fireChunk = (
      from: number, to: number, beatStart: number, allowBranches: boolean,
    ): { beatsAdded: number; aborted: boolean } => {
      let localB = beatStart;
      for (let i = from; i < to; i++) {
        const tileBeat = localB;
        const res = fireIndex(i, localB);
        if (res.aborted) { closeBass(beat + localB); return { beatsAdded: localB - beatStart, aborted: true }; }
        if (allowBranches && res.beats > 0) {
          queueBranches(path[i].id, beat + tileBeat + res.beats);
        }
        localB += res.beats;
      }
      return { beatsAdded: localB - beatStart, aborted: false };
    };

    // Convert the path into an ordered list of blocks: each block is either
    // a looping section (notes followed by a repeat marker) or a tail of
    // straight notes after the last repeat. Branches inside a looping block
    // only fire on the final pass — the repeat's count must be satisfied
    // before the playhead is allowed to fork.
    let totalBeats = 0;
    let aborted = false;
    let blockStart = 0;
    for (let i = 0; i <= path.length; i++) {
      const isRepeat = i < path.length && path[i].kind === 'repeat';
      const isEnd = i === path.length;
      if (!isRepeat && !isEnd) continue;

      if (isRepeat) {
        const reps = path[i].count === 'inf' ? 1 : (path[i].count as number);
        for (let r = 0; r < reps; r++) {
          const isLast = r === reps - 1;
          const inner = fireChunk(blockStart, i, totalBeats, isLast);
          totalBeats += inner.beatsAdded;
          if (inner.aborted) { aborted = true; break; }
        }
        if (aborted) break;
        blockStart = i + 1;
      } else {
        // Tail (no terminating repeat) — play once.
        const inner = fireChunk(blockStart, i, totalBeats, true);
        totalBeats += inner.beatsAdded;
        if (inner.aborted) { aborted = true; }
      }
    }
    const result = { beatsAdded: totalBeats, aborted };
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
