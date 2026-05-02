import { describe, it, expect, beforeEach } from 'vitest';
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
  const fakeCtx = { currentTime: 42 } as unknown as AudioContext;

  return {
    calls,
    playNote(ev: PlayNoteEvent): void { calls.push({ method: 'playNote', args: [ev] }); },
    stopAll(): void { calls.push({ method: 'stopAll', args: [] }); },
    async setPatch(patchName: string): Promise<void> { calls.push({ method: 'setPatch', args: [patchName] }); },
    getAudioContext(): AudioContext { return fakeCtx; },
    onLoadingChange(cb: (v: boolean) => void): () => void {
      loadingListeners.push(cb);
      return () => {
        const idx = loadingListeners.indexOf(cb);
        if (idx !== -1) loadingListeners.splice(idx, 1);
      };
    },
    _triggerLoading(v: boolean): void { for (const cb of loadingListeners) cb(v); },
  };
}

describe('SongtilesPlayer', () => {
  let fakeEngine: ReturnType<typeof makeFakeEngine>;

  beforeEach(() => {
    fakeEngine = makeFakeEngine();
  });

  it('forwards playNote, stopAll, and setPatch to the injected engine', () => {
    const player = createSongtilesPlayer(fakeEngine);
    const ev: PlayNoteEvent = { midi: 60, when: 0, duration: 0.5, velocity: 80 };

    player.playNote(ev);
    player.stopAll();
    player.setPatch('electric_piano_1');

    expect(fakeEngine.calls).toEqual([
      { method: 'playNote', args: [ev] },
      { method: 'stopAll', args: [] },
      { method: 'setPatch', args: ['electric_piano_1'] },
    ]);
  });

  it('now() returns AudioContext.currentTime from the engine', () => {
    const player = createSongtilesPlayer(fakeEngine);
    expect(player.now()).toBe(42);
  });

  it('onLoadingChange subscriptions are forwarded and unsubscribe works', () => {
    const player = createSongtilesPlayer(fakeEngine);
    const received: boolean[] = [];
    const unsub = player.onLoadingChange(v => received.push(v));

    fakeEngine._triggerLoading(true);
    fakeEngine._triggerLoading(false);
    expect(received).toEqual([true, false]);

    unsub();
    fakeEngine._triggerLoading(true);
    expect(received).toEqual([true, false]);
  });
});
