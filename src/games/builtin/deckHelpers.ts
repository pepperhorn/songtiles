import type { Tile, TileId, Wildness } from '../../graph/types';
import { newTileId } from '../../utils/id';
import { listTileKinds } from '../../tiles/registry';
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
 * midi 36..83 (4 octaves × 3 copies each), then mix in wildcards contributed
 * by every registered TileKind that implements `deckWildcards`. Result is
 * shuffled.
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

  const noteCount = ids.length;
  const addTile = (tile: Tile) => {
    const id = tile.id || newTileId();
    tiles[id] = { ...tile, id };
    ids.push(id);
  };
  for (const kind of listTileKinds()) {
    kind.deckWildcards?.({ noteCount, wildness, addTile });
  }

  shuffle(ids, rng);
  return { tiles, deck: ids, tray: [], discardedCount: 0 };
}
