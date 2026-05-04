import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerTileKind, getTileKind, listTileKinds, _resetRegistryForTests,
} from '../../src/tiles/registry';
import type { TileKind } from '../../src/tiles/types';

const dummy: TileKind = {
  id: 'dummy', label: 'Dummy',
  renderContent: () => null,
};

describe('tile kind registry', () => {
  beforeEach(() => _resetRegistryForTests());

  it('registers and retrieves a tile kind', () => {
    registerTileKind(dummy);
    expect(getTileKind('dummy')).toBe(dummy);
  });

  it('lists registered kinds in registration order', () => {
    registerTileKind({ ...dummy, id: 'a' });
    registerTileKind({ ...dummy, id: 'b' });
    expect(listTileKinds().map(k => k.id)).toEqual(['a', 'b']);
  });

  it('throws on duplicate id', () => {
    registerTileKind(dummy);
    expect(() => registerTileKind(dummy)).toThrow(/already registered/);
  });

  it('returns undefined for unknown id', () => {
    expect(getTileKind('nope')).toBeUndefined();
  });
});
