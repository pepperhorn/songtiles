import { describe, it, expect, beforeEach } from 'vitest';
import { serialiseSession, deserialiseSession } from '../../src/state/persistence';
import { useAppStore } from '../../src/state/store';

describe('persistence', () => {
  beforeEach(() => {
    useAppStore.getState().initSession({
      trayCapacity: 8,
      wildness: 'wild',
      gameMode: 'explorer',
    });
  });

  it('serialiseSession produces version 2 JSON with the new mode/wildness fields', () => {
    const state = useAppStore.getState();
    const json = serialiseSession(state);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(2);
    expect(parsed.savedAt).toBeTruthy();
    expect(parsed.bpm).toBe(state.bpm);
    expect(parsed.patchId).toBe(state.patchId);
    expect(parsed.trayCapacity).toBe(state.trayCapacity);
    expect(parsed.wildness).toBe(state.wildness);
    expect(parsed.gameMode).toBe(state.gameMode);
    expect(parsed.scaleRoot).toBe(state.scaleRoot);
    expect(parsed.scaleType).toBe(state.scaleType);
    expect(parsed.discardedCount).toBe(state.discardedCount);
    expect(parsed.placements).toBeDefined();
    expect(Array.isArray(parsed.placements.canvas)).toBe(true);
    expect(Array.isArray(parsed.placements.tray)).toBe(true);
    expect(Array.isArray(parsed.placements.deck)).toBe(true);
  });

  it('deserialiseSession round-trips state correctly', () => {
    const state = useAppStore.getState();
    const json = serialiseSession(state);
    const parsed = JSON.parse(json);
    const restored = deserialiseSession(parsed);

    expect(restored.version).toBe(2);
    expect(restored.trayCapacity).toBe(state.trayCapacity);
    expect(restored.wildness).toBe(state.wildness);
    expect(restored.gameMode).toBe(state.gameMode);
    expect(restored.placements.tray).toEqual(state.tray);
    expect(restored.placements.deck).toEqual(state.deck);
    expect(Object.keys(restored.tiles)).toEqual(Object.keys(state.tiles));
    expect(restored.byCell).toBeDefined();
  });

  it('deserialiseSession throws on unsupported version', () => {
    expect(() => deserialiseSession({ version: 1 })).toThrow('Unsupported session version');
  });
});
