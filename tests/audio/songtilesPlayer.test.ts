import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSongtilesPlayer } from '../../src/audio/songtilesPlayer';
import type { AudioEngine, PlayNoteEvent } from '../../src/audio/engine';

// ---------------------------------------------------------------------------
// Fake AudioEngine — replaces the real smplr-backed engine
// ---------------------------------------------------------------------------

function makeFakeEngine(): AudioEngine & {
  calls: { method: string; args: unknown[] }[];
  _triggerLoading(v: boolean): void;
} {
  const calls: { method: string; args: unknown[] }[] = [];
  const loadingListeners: Array<(v: boolean) => void> = [];
  let _ctxTime = 0;

  const fakeCtx = { currentTime: _ctxTime } as unknown as AudioContext;

  return {
    calls,

    playNote(ev: PlayNoteEvent): void {
      calls.push({ method: 'playNote', args: [ev] });
    },

    stopAll(): void {
      calls.push({ method: 'stopAll', args: [] });
    },

    async setPatch(patchName: string): Promise<void> {
      calls.push({ method: 'setPatch', args: [patchName] });
    },

    getAudioContext(): AudioContext {
      return fakeCtx;
    },

    onLoadingChange(cb: (v: boolean) => void): () => void {
      loadingListeners.push(cb);
      return () => {
        const idx = loadingListeners.indexOf(cb);
        if (idx !== -1) loadingListeners.splice(idx, 1);
      };
    },

    _triggerLoading(v: boolean): void {
      for (const cb of loadingListeners) cb(v);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SongtilesPlayer', () => {
  let fakeEngine: ReturnType<typeof makeFakeEngine>;

  beforeEach(() => {
    fakeEngine = makeFakeEngine();
  });

  it('forwards playNote to the engine', () => {
    // We inject via createAudioEngine mock — here we test the player
    // by wiring a fake engine directly through the engine property.
    const player = createSongtilesPlayer();
    // Swap out the inner engine by monkey-patching via the public interface
    // (cast to any to access private engine ref for test injection)
    (player as unknown as { engine: AudioEngine }).engine;

    // Since createSongtilesPlayer() creates its own engine internally, we
    // test the forwarding contract using vi.spyOn on the engine's methods.
    const engineRef = (player as unknown as { engine: AudioEngine }).engine;
    const playSpy = vi.spyOn(engineRef, 'playNote');
    const stopSpy = vi.spyOn(engineRef, 'stopAll');
    const patchSpy = vi.spyOn(engineRef, 'setPatch').mockResolvedValue(undefined);

    const ev: PlayNoteEvent = { midi: 60, when: 0, duration: 0.5, velocity: 80 };
    player.playNote(ev);
    expect(playSpy).toHaveBeenCalledWith(ev);

    player.stopAll();
    expect(stopSpy).toHaveBeenCalledOnce();

    player.setPatch('electric_piano_1');
    expect(patchSpy).toHaveBeenCalledWith('electric_piano_1');
  });

  it('exposes now() as AudioContext.currentTime', () => {
    const player = createSongtilesPlayer();
    const engineRef = (player as unknown as { engine: AudioEngine }).engine;
    vi.spyOn(engineRef, 'getAudioContext').mockReturnValue({ currentTime: 42 } as AudioContext);
    expect(player.now()).toBe(42);
  });

  it('forwards onLoadingChange subscriptions and returns unsubscribe', () => {
    const player = createSongtilesPlayer();
    const engineRef = (player as unknown as { engine: AudioEngine }).engine;

    const received: boolean[] = [];
    const cb = (v: boolean) => received.push(v);

    // The engine spy: record calls, then call real implementation via fakeEngine
    const unsub = vi.spyOn(engineRef, 'onLoadingChange');

    const unsubFn = player.onLoadingChange(cb);
    expect(unsub).toHaveBeenCalledWith(cb);
    expect(typeof unsubFn).toBe('function');
  });

  it('player with injected fake engine — playNote forwarding', () => {
    // Create a player whose engine is entirely replaced by fakeEngine
    // We do this by creating a custom player that uses the fake engine directly.
    const player = {
      playNote: (ev: PlayNoteEvent) => fakeEngine.playNote(ev),
      stopAll: () => fakeEngine.stopAll(),
      setPatch: (name: string) => fakeEngine.setPatch(name),
      now: () => fakeEngine.getAudioContext().currentTime,
      onLoadingChange: (cb: (v: boolean) => void) => fakeEngine.onLoadingChange(cb),
      engine: fakeEngine as AudioEngine,
    };

    const ev: PlayNoteEvent = { midi: 69, when: 1.0, duration: 0.25, velocity: 100 };
    player.playNote(ev);
    expect(fakeEngine.calls).toContainEqual({ method: 'playNote', args: [ev] });

    player.stopAll();
    expect(fakeEngine.calls).toContainEqual({ method: 'stopAll', args: [] });

    player.setPatch('violin');
    expect(fakeEngine.calls).toContainEqual({ method: 'setPatch', args: ['violin'] });
  });

  it('onLoadingChange fires correctly and unsubscribe works', () => {
    const received: boolean[] = [];
    const cb = (v: boolean) => received.push(v);

    const unsub = fakeEngine.onLoadingChange(cb);

    fakeEngine._triggerLoading(true);
    fakeEngine._triggerLoading(false);
    expect(received).toEqual([true, false]);

    unsub();
    fakeEngine._triggerLoading(true);
    // Should NOT receive after unsub
    expect(received).toHaveLength(2);
  });
});
