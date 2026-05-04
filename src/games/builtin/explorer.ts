import type { GameMode } from '../types';
import { buildDeckFromPitchClasses } from './deckHelpers';

/** Explorer mode: every chromatic pitch class. */
export interface ExplorerParams {}

export const EXPLORER_MODE: GameMode<ExplorerParams> = {
  id: 'explorer',
  label: 'Explorer',
  blurb: 'Every note. Make any song.',
  defaultParams: {},
  buildDeck({ wildness, rng }) {
    const all = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    return buildDeckFromPitchClasses(all, wildness, rng);
  },
};
