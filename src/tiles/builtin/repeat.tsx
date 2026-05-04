import type { TileKind, RenderContentProps } from '../types';
import type { RepeatTile } from '../../graph/types';
import { WILDNESS_RATIO } from '../../graph/types';
import { newTileId } from '../../utils/id';

function RepeatContent({ tile, size, tokens }: RenderContentProps) {
  if (tile.kind !== 'repeat') return null;
  const countLabel = tile.count === 'inf' ? '∞' : `${tile.count}×`;
  return (
    <>
      <span
        className="repeat-label"
        style={{
          fontFamily: "'Bricolage Grotesque', sans-serif",
          fontWeight: 800,
          fontSize: size * 0.18,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: tokens.textPrimary,
        }}
      >
        Repeat
      </span>
      <span
        className="repeat-count absolute bottom-1.5 right-2 tabular-nums"
        style={{ color: tokens.textPrimary, fontWeight: 700, fontSize: size * 0.13 }}
      >
        {countLabel}
      </span>
    </>
  );
}

export const REPEAT_KIND: TileKind = {
  id: 'repeat',
  label: 'Repeat',
  renderContent: RepeatContent,
  onTap(id, store) {
    store.getState().cycleRepeatCount(id);
  },
  deckWildcards({ noteCount, wildness, addTile }) {
    const count = Math.round(noteCount * WILDNESS_RATIO[wildness]);
    for (let i = 0; i < count; i++) {
      const id = newTileId();
      const tile: RepeatTile = { id, kind: 'repeat', count: 1, cell: null };
      addTile(tile);
    }
  },
};
