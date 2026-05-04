import { describe, it, expect, beforeEach } from 'vitest';
import { serialiseSession, deserialiseSession } from '../../src/state/persistence';
import { useAppStore } from '../../src/state/store';
import '../../src/games/builtin';

describe('persistence', () => {
  beforeEach(() => {
    useAppStore.getState().initSession({
      trayCapacity: 8,
      wildness: 'wild',
      gameMode: 'explorer',
      gameParams: {},
    });
  });

  it('serialiseSession produces version 3 JSON with gameParams', () => {
    const state = useAppStore.getState();
    const json = serialiseSession(state);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(3);
    expect(parsed.savedAt).toBeTruthy();
    expect(parsed.bpm).toBe(state.bpm);
    expect(parsed.patchId).toBe(state.patchId);
    expect(parsed.trayCapacity).toBe(state.trayCapacity);
    expect(parsed.wildness).toBe(state.wildness);
    expect(parsed.gameMode).toBe(state.gameMode);
    expect(parsed.gameParams).toEqual(state.gameParams);
    expect(parsed.discardedCount).toBe(state.discardedCount);
    expect(parsed.placements).toBeDefined();
  });

  it('deserialiseSession round-trips state correctly', () => {
    const state = useAppStore.getState();
    const json = serialiseSession(state);
    const parsed = JSON.parse(json);
    const restored = deserialiseSession(parsed);

    expect(restored.version).toBe(3);
    expect(restored.trayCapacity).toBe(state.trayCapacity);
    expect(restored.wildness).toBe(state.wildness);
    expect(restored.gameMode).toBe(state.gameMode);
    expect(restored.gameParams).toEqual(state.gameParams);
    expect(restored.placements.tray).toEqual(state.tray);
    expect(restored.placements.deck).toEqual(state.deck);
    expect(Object.keys(restored.tiles)).toEqual(Object.keys(state.tiles));
    expect(restored.byCell).toBeDefined();
  });

  it('decodes legacy v2 scale session into gameParams', () => {
    const legacy = {
      version: 2,
      savedAt: '2025-01-01T00:00:00.000Z',
      bpm: 100, patchId: 'piano',
      trayCapacity: 8, wildness: 'wild',
      gameMode: 'scale', scaleRoot: 7, scaleType: 'minor',
      startTileId: null, tiles: {},
      placements: { canvas: [], tray: [], deck: [] },
      discardedCount: 0, segmentSettings: {},
    };
    const restored = deserialiseSession(legacy);
    expect(restored.version).toBe(3);
    expect(restored.gameMode).toBe('scale');
    expect(restored.gameParams).toEqual({ root: 7, type: 'minor' });
  });

  it('decodes legacy v2 explorer session with empty gameParams', () => {
    const legacy = {
      version: 2,
      savedAt: '2025-01-01T00:00:00.000Z',
      bpm: 100, patchId: 'piano',
      trayCapacity: 8, wildness: 'wild',
      gameMode: 'explorer',
      startTileId: null, tiles: {},
      placements: { canvas: [], tray: [], deck: [] },
      discardedCount: 0, segmentSettings: {},
    };
    const restored = deserialiseSession(legacy);
    expect(restored.version).toBe(3);
    expect(restored.gameParams).toEqual({});
  });

  it('throws on unsupported version', () => {
    expect(() => deserialiseSession({ version: 1 })).toThrow('Unsupported session version');
  });
});
