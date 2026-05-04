import type { Tile, TileId, RepeatTile, Wildness } from '../../graph/types';
import { WILDNESS_RATIO } from '../../graph/types';
import { newTileId } from '../../utils/id';
import type { DeckRecord } from '../../state/deck';

type Rng = () => number;

function shuffle<T>(arr: T[], rng: Rng = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Lay down 12 instances of every pitch class in `pcSet` distributed across
 * midi 36..83 (4 octaves × 3 copies each), then mix in repeat-tile wildcards
 * proportional to note count by `wildness` ratio. Result is shuffled.
 */
export function buildDeckFromPitchClasses(
  pcSet: Set<number>,
  wildness: Wildness,
  rng?: Rng,
): DeckRecord {
  const tiles: Record<TileId, Tile> = {};
  const ids: TileId[] = [];

  for (let pc = 0; pc < 12; pc++) {
    if (!pcSet.has(pc)) continue;
    for (const base of [36, 48, 60, 72]) {
      const midi = base + pc;
      if (midi > 83) continue;
      for (let copy = 0; copy < 3; copy++) {
        const id = newTileId();
        tiles[id] = { id, kind: 'note', pitch: midi, bass: false, cell: null };
        ids.push(id);
      }
    }
  }

  const wildcardCount = Math.round(ids.length * WILDNESS_RATIO[wildness]);
  for (let i = 0; i < wildcardCount; i++) {
    const id = newTileId();
    const tile: RepeatTile = { id, kind: 'repeat', count: 1, cell: null };
    tiles[id] = tile;
    ids.push(id);
  }

  shuffle(ids, rng);
  return { tiles, deck: ids, tray: [], discardedCount: 0 };
}
