import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerGameMode, getGameMode, listGameModes, _resetRegistryForTests,
} from '../../src/games/registry';
import type { GameMode } from '../../src/games/types';

const dummy: GameMode<{}> = {
  id: 'dummy', label: 'Dummy', blurb: '',
  defaultParams: {},
  buildDeck: () => ({ tiles: {}, deck: [], tray: [], discardedCount: 0 }),
};

describe('game mode registry', () => {
  beforeEach(() => _resetRegistryForTests());

  it('registers and retrieves a game mode', () => {
    registerGameMode(dummy);
    expect(getGameMode('dummy')).toBe(dummy);
  });

  it('lists registered modes in registration order', () => {
    registerGameMode({ ...dummy, id: 'a' });
    registerGameMode({ ...dummy, id: 'b' });
    expect(listGameModes().map(m => m.id)).toEqual(['a', 'b']);
  });

  it('throws on duplicate id', () => {
    registerGameMode(dummy);
    expect(() => registerGameMode(dummy)).toThrow(/already registered/);
  });

  it('returns undefined for unknown id', () => {
    expect(getGameMode('nope')).toBeUndefined();
  });
});
