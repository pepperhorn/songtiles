import type { ComponentType } from 'react';
import type { Wildness } from '../graph/types';
import type { DeckRecord } from '../state/deck';

export type GameModeId = string;

export interface BuildDeckContext {
  wildness: Wildness;
  /** Mode-specific params, shape defined by the mode itself. */
  params: unknown;
  /** Optional RNG override for tests. */
  rng?: () => number;
}

export interface SetupExtrasProps<P = unknown> {
  params: P;
  setParams: (p: P) => void;
}

export interface GameMode<P = unknown> {
  id: GameModeId;
  label: string;
  blurb: string;
  /** Default params seed when this mode is first selected in the setup UI. */
  defaultParams: P;
  /** Build the shuffled deck for a session in this mode. */
  buildDeck(ctx: BuildDeckContext): DeckRecord;
  /** Optional React fragment rendered in the setup modal when this mode is selected. */
  SetupExtras?: ComponentType<SetupExtrasProps<P>>;
}
