import { describe, it, expect, beforeEach } from 'vitest';
import { serialiseSession, deserialiseSession } from '../../src/state/persistence';
import { useAppStore } from '../../src/state/store';

describe('persistence', () => {
  beforeEach(() => {
    useAppStore.getState().initSession({ trayCapacity: 8, repeatPoolSize: 5 });
  });

  it('serialiseSession produces valid JSON with version 1', () => {
    const state = useAppStore.getState();
    const json = serialiseSession(state);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.savedAt).toBeTruthy();
    expect(parsed.bpm).toBe(state.bpm);
    expect(parsed.patchId).toBe(state.patchId);
    expect(parsed.trayCapacity).toBe(state.trayCapacity);
    expect(parsed.repeatPoolSize).toBe(state.repeatPoolSize);
    expect(parsed.repeatSetsRemaining).toBe(state.repeatSetsRemaining);
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

    expect(restored.version).toBe(1);
    expect(restored.trayCapacity).toBe(state.trayCapacity);
    expect(restored.repeatPoolSize).toBe(state.repeatPoolSize);
    expect(restored.placements.tray).toEqual(state.tray);
    expect(restored.placements.deck).toEqual(state.deck);
    expect(Object.keys(restored.tiles)).toEqual(Object.keys(state.tiles));
    // byCell is rebuilt from tiles
    expect(restored.byCell).toBeDefined();
  });

  it('deserialiseSession throws on unsupported version', () => {
    expect(() => deserialiseSession({ version: 2 })).toThrow('Unsupported session version');
  });

  it('deserialiseSession throws when note tile total exceeds 144', () => {
    const state = useAppStore.getState();
    const json = serialiseSession(state);
    const parsed = JSON.parse(json);
    // Force discardedCount way above 144
    parsed.discardedCount = 200;
    expect(() => deserialiseSession(parsed)).toThrow('Invariant violated');
  });
});
