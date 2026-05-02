import { createAudioEngine, type AudioEngine, type PlayNoteEvent } from './engine';

// ---------------------------------------------------------------------------
// SongtilesPlayer
// A thin facade over AudioEngine with a convenience `now()` helper.
// One singleton instance is created lazily on first access.
// ---------------------------------------------------------------------------

export interface SongtilesPlayer {
  /** Play a single note. `when` is an absolute AudioContext time (seconds). */
  playNote(ev: PlayNoteEvent): void;
  /** Stop all currently-sounding notes immediately. */
  stopAll(): void;
  /** Swap the active soundfont patch. Resolves when the new patch is loaded. */
  setPatch(patchName: string): Promise<void>;
  /** Current AudioContext time — use as the base for scheduling. */
  now(): number;
  /** Subscribe to loading-state changes. Returns an unsubscribe function. */
  onLoadingChange(cb: (loading: boolean) => void): () => void;
  /** Expose the underlying engine for advanced use. */
  readonly engine: AudioEngine;
}

export function createSongtilesPlayer(engine: AudioEngine = createAudioEngine()): SongtilesPlayer {
  return {
    playNote(ev: PlayNoteEvent): void {
      engine.playNote(ev);
    },

    stopAll(): void {
      engine.stopAll();
    },

    async setPatch(patchName: string): Promise<void> {
      return engine.setPatch(patchName);
    },

    now(): number {
      return engine.getAudioContext().currentTime;
    },

    onLoadingChange(cb: (loading: boolean) => void): () => void {
      return engine.onLoadingChange(cb);
    },

    get engine(): AudioEngine {
      return engine;
    },
  };
}

// ---------------------------------------------------------------------------
// Default singleton — convenient for most use-cases
// ---------------------------------------------------------------------------

let _defaultPlayer: SongtilesPlayer | null = null;

export function getPlayer(): SongtilesPlayer {
  if (!_defaultPlayer) _defaultPlayer = createSongtilesPlayer();
  return _defaultPlayer;
}
