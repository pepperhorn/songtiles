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
      instrument.start({
        note: ev.midi,
        time: ev.when,
        duration: ev.duration,
        velocity: ev.velocity,
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
