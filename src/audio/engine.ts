import { Soundfont } from 'smplr';
import { getStorage, markCached } from './sampleCache';

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export interface PlayNoteEvent {
  midi: number;
  when: number;
  duration: number;
  velocity: number;
}

export interface AudioEngine {
  playNote(ev: PlayNoteEvent): void;
  stopAll(): void;
  setPatch(patchName: string): Promise<void>;
  getAudioContext(): AudioContext;
  onLoadingChange(cb: (loading: boolean) => void): () => void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const DEFAULT_PATCH = 'acoustic_grand_piano';

export function createAudioEngine(): AudioEngine {
  let ctx: AudioContext | null = null;
  let instrument: Soundfont | null = null;
  let currentPatch: string = DEFAULT_PATCH;
  let loading = false;
  // Simple queue — drop notes that arrive before any patch has loaded
  let loadingListeners: Array<(loading: boolean) => void> = [];

  function getCtx(): AudioContext {
    if (!ctx) ctx = new AudioContext();
    // iOS/Safari (and sometimes desktop) start the context suspended even after
    // the AudioContext is constructed inside a user gesture. Kick it awake.
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function notifyLoading(value: boolean) {
    for (const cb of loadingListeners) cb(value);
  }

  async function loadPatch(patchName: string): Promise<void> {
    loading = true;
    notifyLoading(true);
    try {
      const ac = getCtx();
      const sf = new Soundfont(ac, {
        instrument: patchName,
        storage: getStorage(),
      });
      await sf.load;
      instrument = sf;
      currentPatch = patchName;
      markCached(patchName);
    } finally {
      loading = false;
      notifyLoading(false);
    }
  }

  return {
    playNote(ev: PlayNoteEvent): void {
      // If the instrument hasn't loaded yet, drop the event (acceptable for v1)
      if (!instrument) return;
      // smplr expects MIDI velocity (0..127). Callers pass a 0..1 normalised value
      // (or 0..127 directly) — scale the small numbers up so we don't fire silent notes.
      const v = ev.velocity > 1 ? ev.velocity : Math.round(ev.velocity * 127);
      // duration triggers smplr's internal note-off at when + duration. We also
      // shorten ampRelease so the natural soundfont tail doesn't bleed into the
      // next beat. Don't call the returned StopFn here — calling it appears to
      // cancel the still-pending note, producing a ringing/retrigger effect on
      // each scheduler tick.
      instrument.start({
        note: ev.midi,
        time: ev.when,
        duration: ev.duration,
        velocity: v,
        ampRelease: 0.08,
      });
    },

    stopAll(): void {
      if (instrument) instrument.stop();
    },

    async setPatch(patchName: string): Promise<void> {
      if (patchName === currentPatch && instrument) return;
      await loadPatch(patchName);
    },

    getAudioContext(): AudioContext {
      return getCtx();
    },

    onLoadingChange(cb: (loading: boolean) => void): () => void {
      loadingListeners = [...loadingListeners, cb];
      return () => {
        loadingListeners = loadingListeners.filter((l) => l !== cb);
      };
    },
  };
}
