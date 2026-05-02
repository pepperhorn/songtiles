import { Soundfont, Mellotron, Mallet, type NoteEvent, type StopTarget } from 'smplr';
import { getStorage, markCached } from './sampleCache';
import { getLibraryForPatch } from '../constants/patchRegistry';

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

const DEFAULT_PATCH = 'acoustic_grand_piano';

// Minimal contract every smplr instrument we use exposes.
interface SmplrLike {
  load: Promise<unknown>;
  start(ev: NoteEvent): unknown;
  stop(target?: StopTarget): void;
}

export function createAudioEngine(): AudioEngine {
  let ctx: AudioContext | null = null;
  let instrument: SmplrLike | null = null;
  let currentPatch: string = DEFAULT_PATCH;
  let loadingListeners: Array<(loading: boolean) => void> = [];

  function getCtx(): AudioContext {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    return ctx;
  }

  function notifyLoading(value: boolean) {
    for (const cb of loadingListeners) cb(value);
  }

  function constructInstrument(patchName: string): SmplrLike {
    const ac = getCtx();
    const library = getLibraryForPatch(patchName);
    const opts = { instrument: patchName, storage: getStorage() };
    switch (library) {
      case 'Mellotron': return new Mellotron(ac, opts);
      case 'Mallet':    return new Mallet(ac, opts);
      // SplendidGrandPiano, ElectricPiano, Smolken, DrumMachine, Soundfont
      // all use Soundfont-compatible options. We only ship Soundfont/Mellotron/
      // Mallet patches in v1's picker; everything else falls through to Soundfont
      // which acts as the safe default.
      default:          return new Soundfont(ac, opts);
    }
  }

  async function loadPatch(patchName: string): Promise<void> {
    notifyLoading(true);
    try {
      const next = constructInstrument(patchName);
      await next.load;
      // Tear down the old voice before swapping so leftover notes from the
      // previous patch don't keep ringing.
      try { instrument?.stop(); } catch { /* ignored */ }
      instrument = next;
      currentPatch = patchName;
      markCached(patchName);
    } finally {
      notifyLoading(false);
    }
  }

  return {
    playNote(ev: PlayNoteEvent): void {
      if (!instrument) return;
      const v = ev.velocity > 1 ? ev.velocity : Math.round(ev.velocity * 127);
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
