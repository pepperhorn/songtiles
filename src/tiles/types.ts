import type { CSSProperties, ReactNode } from 'react';
import type { Tile, TileId, Wildness } from '../graph/types';
import type { ThemeTokens } from '../theme/tokens';
import type { useAppStore } from '../state/store';

export type TileKindId = string;

export interface RenderContentProps {
  tile: Tile;
  size: number;
  tokens: ThemeTokens;
}

export interface ContainerStyleProps {
  tile: Tile;
  tokens: ThemeTokens;
}

export interface TileKind {
  id: TileKindId;
  label: string;
  /** Render the inner visual content of a tile of this kind (caller owns the
   *  outer chrome: size, border, drop shadow, halo). */
  renderContent(props: RenderContentProps): ReactNode;
  /** Optional: contribute container style (e.g. background color) on top of
   *  the standard chrome. */
  containerStyle?(props: ContainerStyleProps): CSSProperties;
  /** Optional: extra class names appended to the outer container. */
  containerClassName?: string;
  /** Optional handler invoked when the user taps this tile (after a successful
   *  tap, not a drag). Receives the tile id and the store reference. */
  onTap?(id: TileId, store: typeof useAppStore): void;
  /** Optional: number of wildcard tiles of this kind to mix into a freshly
   *  built deck. Receives the note count for the deck and the chosen wildness.
   *  Implementations should also create the tiles via the second arg. */
  deckWildcards?(opts: {
    noteCount: number;
    wildness: Wildness;
    /** Push a freshly-constructed tile (with cell:null) onto the deck. */
    addTile: (tile: Tile) => void;
  }): void;
}
