# Songtiles v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Songtiles v1 mobile-first React music app described in [`docs/superpowers/specs/2026-05-02-songtiles-design.md`](../specs/2026-05-02-songtiles-design.md).

**Architecture:** React + TypeScript + Vite single-page app, Zustand store, smplr audio engine ported from `dottl`, Tailwind + Poppins, light/dark theme tokens. State splits into pure modules (graph adjacency, segment computation, repeat pairing, deck) plus a scheduler that walks the segment graph and emits smplr events with a 2-second look-ahead window.

**Tech Stack:** Vite, React 18, TypeScript, Zustand, Tailwind CSS, smplr (Web Audio), Vitest, @testing-library/react, Petaluma SMuFL font.

**Reference codebase:** `/home/shaun/dottl/` — port `src/audio/{engine,instruments,sampleCache}.ts`, `src/constants/{patchRegistry,music}.ts` (the `CRF_COLORS` map at `music.ts:15`).

---

## File Structure

```
songtiles/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── public/
│   ├── manifest.webmanifest
│   └── fonts/
│       └── Petaluma.woff2
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── audio/
│   │   ├── engine.ts            # ported from dottl
│   │   ├── instruments.ts       # ported from dottl
│   │   ├── sampleCache.ts       # ported from dottl
│   │   └── songtilesPlayer.ts   # thin wrapper exposing playNote/stop
│   ├── constants/
│   │   ├── noteColors.ts        # ported CRF_COLORS + theme variants
│   │   ├── patchRegistry.ts     # ported from dottl
│   │   └── petaluma.ts          # repeat glyph code points
│   ├── theme/
│   │   ├── tokens.ts            # semantic tokens (canvas.bg, tile.shadow, …)
│   │   └── ThemeProvider.tsx    # OS-follow + manual override
│   ├── graph/
│   │   ├── types.ts             # Cell, TileId, Tile, Pitch, etc.
│   │   ├── adjacency.ts         # neighbors, endpoint, intersection helpers
│   │   ├── segments.ts          # walk graph from start → segments
│   │   └── repeats.ts           # pair Open/Close along a path
│   ├── playback/
│   │   ├── events.ts            # NoteEvent type, schedule helpers
│   │   ├── playhead.ts          # PlayheadState + advance step
│   │   └── scheduler.ts         # 2s look-ahead loop
│   ├── state/
│   │   ├── store.ts             # zustand store
│   │   ├── deck.ts              # 144-tile deck, draw/discard/refill
│   │   └── persistence.ts       # save/load JSON, localStorage autosave
│   ├── components/
│   │   ├── Canvas.tsx           # pan/zoom + tile rendering + playhead overlay
│   │   ├── Tile.tsx             # single tile visual
│   │   ├── Tray.tsx             # bottom tray with flick-to-discard
│   │   ├── RepeatPocket.tsx     # side-pocket for repeat sets
│   │   ├── TopBar.tsx           # play/stop, BPM, patch, theme toggle
│   │   ├── DetailPanel.tsx      # mode/hold/bass/return controls
│   │   └── SetupModal.tsx       # initial tray-capacity + repeat-pool picker
│   └── utils/
│       └── id.ts                # tile id factory
└── tests/
    ├── graph/{adjacency,segments,repeats}.test.ts
    ├── playback/{playhead,scheduler}.test.ts
    ├── state/{deck,persistence}.test.ts
    └── components/  (selective integration tests)
```

Each `src/` file has one focused responsibility; tests mirror layout.

---

## Milestone overview

1. **M1:** Project scaffold + tooling
2. **M2:** Port dottl audio (smplr) — verify a single note plays
3. **M3:** Theme tokens + light/dark + dottl note colours
4. **M4:** Core types, deck generation, Zustand store skeleton
5. **M5:** Tray UI with draw / discard / refill (no canvas yet)
6. **M6:** Canvas pan/zoom + tile drag-from-tray placement
7. **M7:** Adjacency rules + endpoint retrieval + halo'd start
8. **M8:** Segment computation
9. **M9:** Sequential playback with rolling 2s look-ahead
10. **M10:** Branching playheads at intersections
11. **M11:** Detail panel + Solid/Arp chord modes + hold
12. **M12:** Bass-mode flip
13. **M13:** Repeat-Open/Close tiles + pool + Petaluma + repeat playback
14. **M14:** Save/Load JSON + localStorage autosave
15. **M15:** Setup modal, mobile polish (flick-to-discard, gestures), PWA manifest

---

## Task 1 — M1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `vitest.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`

- [ ] **Step 1: Init Vite + React + TS**

```bash
cd /home/shaun/songtiles
npm create vite@latest . -- --template react-ts
# When prompted "Current directory is not empty", choose "Ignore files and continue"
npm install
```

- [ ] **Step 2: Install runtime + dev deps**

```bash
npm install zustand smplr
npm install -D tailwindcss@latest postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @types/node
npx tailwindcss init -p
```

- [ ] **Step 3: Configure Tailwind**

`tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss';
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Poppins', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 4: Wire Poppins + Tailwind layers**

Replace `src/index.css` with:

```css
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { @apply font-sans antialiased; }
```

- [ ] **Step 5: Vitest config**

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true, setupFiles: ['./tests/setup.ts'] },
});
```

`tests/setup.ts`:

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 6: Update vite dev script for LAN access**

In `package.json`, change `"dev": "vite"` → `"dev": "vite --host 0.0.0.0"` and add `"test": "vitest"`.

- [ ] **Step 7: Hello-world App**

`src/App.tsx`:

```tsx
export default function App() {
  return <div className="app-root grid place-items-center min-h-screen">Songtiles</div>;
}
```

- [ ] **Step 8: Smoke test the dev server**

```bash
npm run dev
# Open http://localhost:5173 — expect "Songtiles" centred on the page. Ctrl-C to stop.
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(scaffold): Vite + React + TS + Tailwind + Vitest

Boilerplate scaffold with Poppins, Tailwind dark-mode class strategy,
and Vitest configured against jsdom. Vite dev server binds 0.0.0.0."
```

---

## Task 2 — M2: Port dottl audio engine

**Files:**
- Copy: `/home/shaun/dottl/src/audio/{engine,instruments,sampleCache}.ts` → `src/audio/`
- Copy: `/home/shaun/dottl/src/constants/patchRegistry.ts` → `src/constants/patchRegistry.ts`
- Create: `src/audio/songtilesPlayer.ts`
- Test: `tests/audio/songtilesPlayer.test.ts`

- [ ] **Step 1: Copy files verbatim**

```bash
cp /home/shaun/dottl/src/audio/engine.ts src/audio/engine.ts
cp /home/shaun/dottl/src/audio/instruments.ts src/audio/instruments.ts
cp /home/shaun/dottl/src/audio/sampleCache.ts src/audio/sampleCache.ts
cp /home/shaun/dottl/src/constants/patchRegistry.ts src/constants/patchRegistry.ts
```

- [ ] **Step 2: Strip dottl-only imports**

Open each ported file and prune any imports that reference dottl modules we didn't copy (e.g. `metronome`, `sequencer`, dottl-specific types). Replace dottl-specific types with local equivalents using `unknown` or simple inline types where practical. Keep the smplr-facing logic intact.

- [ ] **Step 3: Write the wrapper test (failing)**

`tests/audio/songtilesPlayer.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createSongtilesPlayer } from '../../src/audio/songtilesPlayer';

describe('songtilesPlayer', () => {
  it('exposes playNote / stopAll and forwards midi to the engine', () => {
    const fakeEngine = {
      playNote: vi.fn(),
      stopAll: vi.fn(),
      setPatch: vi.fn(),
      getAudioContext: () => ({ currentTime: 0 } as AudioContext),
    };
    const player = createSongtilesPlayer(fakeEngine as never);
    player.playNote({ midi: 60, when: 0, duration: 0.5, velocity: 0.8 });
    expect(fakeEngine.playNote).toHaveBeenCalledWith({ midi: 60, when: 0, duration: 0.5, velocity: 0.8 });
  });
});
```

- [ ] **Step 4: Run — expect failure**

```bash
npx vitest run tests/audio/songtilesPlayer.test.ts
# Expected: FAIL — module './songtilesPlayer' not found
```

- [ ] **Step 5: Implement the wrapper**

`src/audio/songtilesPlayer.ts`:

```ts
import type { AudioEngine } from './engine';

export type NoteEvent = { midi: number; when: number; duration: number; velocity: number };

export interface SongtilesPlayer {
  playNote(ev: NoteEvent): void;
  stopAll(): void;
  setPatch(id: string): Promise<void>;
  now(): number;
}

export function createSongtilesPlayer(engine: AudioEngine): SongtilesPlayer {
  return {
    playNote: ev => engine.playNote(ev),
    stopAll: () => engine.stopAll(),
    setPatch: id => engine.setPatch(id),
    now: () => engine.getAudioContext().currentTime,
  };
}
```

(Adjust `AudioEngine` import shape if the ported `engine.ts` exports a different name; the wrapper's interface is the contract the rest of the app uses.)

- [ ] **Step 6: Run — expect pass**

```bash
npx vitest run tests/audio/songtilesPlayer.test.ts
# Expected: 1 passed
```

- [ ] **Step 7: Manual smoke test**

Add a one-shot button to `App.tsx` that calls `playNote({ midi: 60, when: 0, duration: 0.5, velocity: 0.8 })` after a user click (Web Audio requires a gesture to unlock). Verify a piano-ish C4 plays in the browser. Remove the button after verifying.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(audio): port dottl smplr engine + add SongtilesPlayer wrapper

Copies engine/instruments/sampleCache/patchRegistry from dottl and
adds a thin SongtilesPlayer that exposes the playNote / stopAll /
setPatch / now contract used by the rest of the app."
```

---

## Task 3 — M3: Theme tokens + light/dark + note colours

**Files:**
- Create: `src/constants/noteColors.ts`, `src/theme/tokens.ts`, `src/theme/ThemeProvider.tsx`
- Modify: `src/index.css`, `tailwind.config.ts`, `src/App.tsx`
- Test: `tests/theme/tokens.test.ts`

- [ ] **Step 1: Port note colours**

`src/constants/noteColors.ts`:

```ts
// Ported from /home/shaun/dottl/src/constants/music.ts (CRF_COLORS).
// Map of note pitch class (sharp spelling) to dottl colour.
export type PitchClass = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export const NOTE_COLORS_LIGHT: Record<PitchClass, string> = {
  // Copy values from /home/shaun/dottl/src/constants/music.ts CRF_COLORS verbatim.
  // (Open that file and paste the 12 entries here, keyed by sharp names.)
  C:  '__FROM_DOTTL__', 'C#': '__FROM_DOTTL__', D:  '__FROM_DOTTL__', 'D#': '__FROM_DOTTL__',
  E:  '__FROM_DOTTL__', F:  '__FROM_DOTTL__', 'F#': '__FROM_DOTTL__', G:  '__FROM_DOTTL__',
  'G#': '__FROM_DOTTL__', A:  '__FROM_DOTTL__', 'A#': '__FROM_DOTTL__', B:  '__FROM_DOTTL__',
};

// Dark-mode tints: same hue, ~12% darker / slightly desaturated so they
// don't glow against the dark canvas. Computed once at build by hand
// (or via a colour utility); store as static strings to keep runtime simple.
export const NOTE_COLORS_DARK: Record<PitchClass, string> = {
  // Replace with manually-tuned dark-mode counterparts; start by copying light
  // and adjusting in the browser, then locking values in.
  ...NOTE_COLORS_LIGHT,
};

export function midiToPitchClass(midi: number): PitchClass {
  const names: PitchClass[] = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  return names[((midi % 12) + 12) % 12];
}

export function midiToOctave(midi: number): number {
  return Math.floor(midi / 12) - 1;
}
```

(The `__FROM_DOTTL__` strings must be replaced before commit — open the dottl source and copy the actual hex values in.)

- [ ] **Step 2: Theme tokens**

`src/theme/tokens.ts`:

```ts
import { NOTE_COLORS_DARK, NOTE_COLORS_LIGHT, type PitchClass } from '../constants/noteColors';

export type ThemeMode = 'light' | 'dark';

export interface ThemeTokens {
  canvasBg: string;
  gridDot: string;
  textPrimary: string;
  textSubtle: string;
  tileShadow: string;
  tileBevel: string;
  tilePlayhead: string;
  trayBg: string;
  topBarBg: string;
  noteBg: (pc: PitchClass) => string;
}

export const LIGHT: ThemeTokens = {
  canvasBg: '#FAF7F2',
  gridDot: 'rgba(0,0,0,0.08)',
  textPrimary: '#1A1A1F',
  textSubtle: 'rgba(26,26,31,0.6)',
  tileShadow: '0 2px 6px rgba(0,0,0,0.12)',
  tileBevel: 'inset 0 -1px 0 rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.6)',
  tilePlayhead: 'rgba(255,200,80,0.9)',
  trayBg: '#F2EEE7',
  topBarBg: '#FFFFFF',
  noteBg: pc => NOTE_COLORS_LIGHT[pc],
};

export const DARK: ThemeTokens = {
  canvasBg: '#1A1A1F',
  gridDot: 'rgba(255,255,255,0.07)',
  textPrimary: '#F5F5F2',
  textSubtle: 'rgba(245,245,242,0.55)',
  tileShadow: '0 2px 6px rgba(0,0,0,0.6)',
  tileBevel: 'inset 0 -1px 0 rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.06)',
  tilePlayhead: 'rgba(255,210,120,0.85)',
  trayBg: '#23232A',
  topBarBg: '#1F1F25',
  noteBg: pc => NOTE_COLORS_DARK[pc],
};

export function tokensFor(mode: ThemeMode): ThemeTokens {
  return mode === 'dark' ? DARK : LIGHT;
}
```

- [ ] **Step 3: Token test (failing)**

`tests/theme/tokens.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { tokensFor } from '../../src/theme/tokens';

describe('theme tokens', () => {
  it('returns distinct canvas backgrounds for light vs dark', () => {
    expect(tokensFor('light').canvasBg).not.toBe(tokensFor('dark').canvasBg);
  });
  it('produces a colour for every pitch class', () => {
    const t = tokensFor('light');
    (['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'] as const).forEach(pc => {
      expect(t.noteBg(pc)).toMatch(/^#|^rgb/);
    });
  });
});
```

- [ ] **Step 4: Run — expect pass**

```bash
npx vitest run tests/theme/tokens.test.ts
# Expected: 2 passed
```

- [ ] **Step 5: Theme provider**

`src/theme/ThemeProvider.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { tokensFor, type ThemeMode, type ThemeTokens } from './tokens';

interface Ctx { mode: ThemeMode; tokens: ThemeTokens; setMode(m: ThemeMode | 'system'): void; }
const ThemeCtx = createContext<Ctx | null>(null);

function detectSystem(): ThemeMode {
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<ThemeMode | 'system'>(() =>
    (localStorage.getItem('songtiles.theme') as ThemeMode | 'system' | null) ?? 'system'
  );
  const [mode, setMode] = useState<ThemeMode>(detectSystem());

  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const update = () => setMode(override === 'system' ? (mq.matches ? 'dark' : 'light') : override);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [override]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }, [mode]);

  return (
    <ThemeCtx.Provider value={{
      mode, tokens: tokensFor(mode),
      setMode: m => { setOverride(m); localStorage.setItem('songtiles.theme', m); }
    }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useTheme outside ThemeProvider');
  return ctx;
}
```

- [ ] **Step 6: Wire provider into the app**

`src/App.tsx`:

```tsx
import { ThemeProvider, useTheme } from './theme/ThemeProvider';

function Inner() {
  const { tokens } = useTheme();
  return (
    <div className="app-root min-h-screen grid place-items-center" style={{ background: tokens.canvasBg, color: tokens.textPrimary }}>
      <div>Songtiles</div>
    </div>
  );
}

export default function App() {
  return <ThemeProvider><Inner /></ThemeProvider>;
}
```

- [ ] **Step 7: Manual verify**

```bash
npm run dev
# Toggle OS dark mode — expect canvas/text to flip without reload.
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(theme): light/dark tokens derived from dottl note palette

Token layer (canvasBg, tileShadow, noteBg(pc), …) so component code
references semantic tokens rather than raw colours. ThemeProvider
follows the OS by default, persists override via localStorage."
```

---

## Task 4 — M4: Core types, deck, store skeleton

**Files:**
- Create: `src/graph/types.ts`, `src/state/deck.ts`, `src/state/store.ts`, `src/utils/id.ts`
- Test: `tests/state/deck.test.ts`

- [ ] **Step 1: Types**

`src/graph/types.ts`:

```ts
export type Cell = { x: number; y: number };
export type TileId = string;
export type Pitch = number; // MIDI 36..84

export interface TileBase { id: TileId; cell: Cell | null }  // null = in tray / deck
export interface NoteTile  extends TileBase { kind: 'note';  pitch: Pitch; bass: boolean }
export interface RepeatOpenTile  extends TileBase { kind: 'repeat-open';  count: 1|2|3|4|'inf' }
export interface RepeatCloseTile extends TileBase { kind: 'repeat-close' }
export type Tile = NoteTile | RepeatOpenTile | RepeatCloseTile;

export type SegmentMode = 'sequential' | 'solid' | 'arp';
export interface SegmentSettings {
  segmentRootId: TileId;
  mode: SegmentMode;
  holdBeats: 1|2|3|4;
}

export type TrayCapacity = 4|6|8|9|10|11|12;
export type RepeatPoolSize = 3|5|8|12;

export const cellKey = (c: Cell) => `${c.x},${c.y}`;
```

`src/utils/id.ts`:

```ts
let n = 0;
export const newTileId = () => `t_${(++n).toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
```

- [ ] **Step 2: Deck — failing test**

`tests/state/deck.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createDeck, drawTo, returnToDeck, discardFromTray } from '../../src/state/deck';

describe('deck', () => {
  it('creates a 144-tile deck with pitches in C2..C6', () => {
    const d = createDeck(() => 0.5); // deterministic rng
    expect(d.deck.length).toBe(144);
    for (const t of Object.values(d.tiles)) {
      if (t.kind === 'note') {
        expect(t.pitch).toBeGreaterThanOrEqual(36);
        expect(t.pitch).toBeLessThanOrEqual(84);
      }
    }
  });

  it('drawTo fills the tray to capacity from the top of the deck', () => {
    let r = createDeck(() => 0.5);
    r = drawTo(r, 6);
    expect(r.tray.length).toBe(6);
    expect(r.deck.length).toBe(144 - 6);
  });

  it('returnToDeck adds an id back to the bottom of the deck', () => {
    let r = createDeck(() => 0.5);
    r = drawTo(r, 6);
    const tid = r.tray[0];
    r = returnToDeck(r, tid);
    expect(r.tray).not.toContain(tid);
    expect(r.deck[r.deck.length - 1]).toBe(tid);
  });

  it('discardFromTray removes the tile and increments discardedCount', () => {
    let r = createDeck(() => 0.5);
    r = drawTo(r, 6);
    const tid = r.tray[0];
    r = discardFromTray(r, tid);
    expect(r.tray).not.toContain(tid);
    expect(r.tiles[tid]).toBeUndefined();
    expect(r.discardedCount).toBe(1);
  });
});
```

- [ ] **Step 3: Run — expect failure (module missing)**

```bash
npx vitest run tests/state/deck.test.ts
# Expected: FAIL — Cannot find module '../../src/state/deck'
```

- [ ] **Step 4: Implement deck**

`src/state/deck.ts`:

```ts
import type { NoteTile, TileId } from '../graph/types';
import { newTileId } from '../utils/id';

export interface DeckRecord {
  tiles: Record<TileId, NoteTile>;
  deck: TileId[];                  // top of deck = index 0
  tray: TileId[];
  discardedCount: number;
}

export function createDeck(rng: () => number = Math.random): DeckRecord {
  const tiles: Record<TileId, NoteTile> = {};
  const deck: TileId[] = [];
  for (let i = 0; i < 144; i++) {
    const id = newTileId();
    tiles[id] = { id, cell: null, kind: 'note', pitch: 36 + Math.floor(rng() * 49), bass: false };
    deck.push(id);
  }
  // Fisher–Yates with the supplied rng
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return { tiles, deck, tray: [], discardedCount: 0 };
}

export function drawTo(r: DeckRecord, capacity: number): DeckRecord {
  if (r.tray.length >= capacity) return r;
  const need = capacity - r.tray.length;
  const drawn = r.deck.slice(0, need);
  return { ...r, deck: r.deck.slice(drawn.length), tray: [...r.tray, ...drawn] };
}

export function returnToDeck(r: DeckRecord, id: TileId): DeckRecord {
  return {
    ...r,
    tray: r.tray.filter(x => x !== id),
    deck: [...r.deck, id],
  };
}

export function discardFromTray(r: DeckRecord, id: TileId): DeckRecord {
  if (!r.tray.includes(id)) return r;
  const { [id]: _gone, ...rest } = r.tiles;
  return {
    ...r,
    tiles: rest,
    tray: r.tray.filter(x => x !== id),
    discardedCount: r.discardedCount + 1,
  };
}
```

- [ ] **Step 5: Run — expect pass**

```bash
npx vitest run tests/state/deck.test.ts
# Expected: 4 passed
```

- [ ] **Step 6: Zustand store skeleton**

`src/state/store.ts`:

```ts
import { create } from 'zustand';
import type { Tile, TileId, SegmentSettings, TrayCapacity, RepeatPoolSize, Cell } from '../graph/types';
import { cellKey } from '../graph/types';
import { createDeck, drawTo, returnToDeck, discardFromTray } from './deck';

export interface AppState {
  tiles: Record<TileId, Tile>;
  byCell: Record<string, TileId>;
  startTileId: TileId | null;
  segmentSettings: Record<TileId, SegmentSettings>;
  tray: TileId[];
  deck: TileId[];
  discardedCount: number;
  trayCapacity: TrayCapacity;
  repeatPoolSize: RepeatPoolSize;
  repeatSetsRemaining: number;
  bpm: number;
  patchId: string;
  isPlaying: boolean;

  // Actions
  initSession(opts: { trayCapacity: TrayCapacity; repeatPoolSize: RepeatPoolSize }): void;
  refillTray(): void;
  discardTrayTile(id: TileId): void;
  placeTileOnCell(id: TileId, cell: Cell): void;
  returnTileFromCanvas(id: TileId): void;
  setStartTile(id: TileId | null): void;
}

export const useStore = create<AppState>((set, get) => ({
  tiles: {}, byCell: {}, startTileId: null, segmentSettings: {},
  tray: [], deck: [], discardedCount: 0,
  trayCapacity: 8, repeatPoolSize: 5, repeatSetsRemaining: 5,
  bpm: 96, patchId: 'piano', isPlaying: false,

  initSession({ trayCapacity, repeatPoolSize }) {
    const d = drawTo(createDeck(), trayCapacity);
    set({
      tiles: d.tiles, tray: d.tray, deck: d.deck, discardedCount: d.discardedCount,
      byCell: {}, startTileId: null, segmentSettings: {},
      trayCapacity, repeatPoolSize, repeatSetsRemaining: repeatPoolSize,
    });
  },

  refillTray() {
    const s = get();
    const d = drawTo({ tiles: s.tiles, tray: s.tray, deck: s.deck, discardedCount: s.discardedCount }, s.trayCapacity);
    set({ tiles: d.tiles, tray: d.tray, deck: d.deck });
  },

  discardTrayTile(id) {
    const s = get();
    const d = discardFromTray({ tiles: s.tiles, tray: s.tray, deck: s.deck, discardedCount: s.discardedCount }, id);
    set({ tiles: d.tiles, tray: d.tray, deck: d.deck, discardedCount: d.discardedCount });
  },

  placeTileOnCell(id, cell) {
    const s = get();
    const tile = s.tiles[id];
    if (!tile) return;
    set({
      tiles: { ...s.tiles, [id]: { ...tile, cell } },
      tray: s.tray.filter(x => x !== id),
      byCell: { ...s.byCell, [cellKey(cell)]: id },
      // Auto-halo first placed tile as start
      startTileId: s.startTileId ?? id,
    });
  },

  returnTileFromCanvas(id) {
    const s = get();
    const tile = s.tiles[id];
    if (!tile?.cell) return;
    const key = cellKey(tile.cell);
    const { [key]: _gone, ...byCell } = s.byCell;
    set({
      tiles: { ...s.tiles, [id]: { ...tile, cell: null } },
      byCell,
      tray: [...s.tray, id],
      startTileId: s.startTileId === id ? null : s.startTileId,
    });
  },

  setStartTile(id) { set({ startTileId: id }); },
}));
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(state): core types, deck (144 tiles), zustand store skeleton

Pure deck reducer (createDeck/drawTo/returnToDeck/discardFromTray)
plus a thin zustand store wiring those reducers into UI-friendly
actions. Auto-halo of first-placed tile as the default start tile."
```

---

## Task 5 — M5: Tray UI (no canvas yet)

**Files:**
- Create: `src/components/Tray.tsx`, `src/components/Tile.tsx`
- Modify: `src/App.tsx`
- Test: `tests/components/Tray.test.tsx`

- [ ] **Step 1: Tile visual component**

`src/components/Tile.tsx`:

```tsx
import { useTheme } from '../theme/ThemeProvider';
import { midiToOctave, midiToPitchClass } from '../constants/noteColors';
import type { Tile as TileT } from '../graph/types';

export function Tile({ tile, size = 96, dimmed = false }: { tile: TileT; size?: number; dimmed?: boolean }) {
  const { tokens } = useTheme();
  if (tile.kind === 'note') {
    const pc = midiToPitchClass(tile.pitch);
    const oct = midiToOctave(tile.pitch);
    return (
      <div
        className="songtile note-tile relative grid place-items-center select-none"
        style={{
          width: size, height: size, borderRadius: 14,
          background: tokens.noteBg(pc), color: '#fff',
          boxShadow: `${tokens.tileShadow}, ${tokens.tileBevel}`,
          opacity: dimmed ? 0.4 : 1,
        }}
      >
        <span className="note-name font-semibold" style={{ fontSize: size * 0.42 }}>{pc}</span>
        <span className="note-octave absolute bottom-1.5 right-2 text-xs opacity-80">{oct}</span>
        {tile.bass && <span className="bass-arrow absolute top-1.5 left-2 text-xs">↓</span>}
      </div>
    );
  }
  // Repeat tiles get their own visual in Task 13; placeholder until then.
  return (
    <div
      className="songtile repeat-tile grid place-items-center"
      style={{
        width: size, height: size, borderRadius: 14, background: tokens.trayBg, color: tokens.textPrimary,
        boxShadow: `${tokens.tileShadow}, ${tokens.tileBevel}`,
      }}
    >
      <span>{tile.kind === 'repeat-open' ? '⟦' : '⟧'}</span>
    </div>
  );
}
```

- [ ] **Step 2: Tray component**

`src/components/Tray.tsx`:

```tsx
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { Tile } from './Tile';

export function Tray() {
  const { tokens } = useTheme();
  const tray = useStore(s => s.tray);
  const tiles = useStore(s => s.tiles);
  const refill = useStore(s => s.refillTray);
  const discard = useStore(s => s.discardTrayTile);
  const capacity = useStore(s => s.trayCapacity);

  return (
    <div className="tray-root fixed bottom-0 left-0 right-0 px-4 pb-4 pt-3 flex items-center gap-3 overflow-x-auto"
         style={{ background: tokens.trayBg }}>
      {tray.map(id => (
        <button
          key={id}
          className="tray-slot"
          onDoubleClick={() => discard(id)}
          aria-label="tray tile"
        >
          <Tile tile={tiles[id]} size={72} />
        </button>
      ))}
      {Array.from({ length: Math.max(0, capacity - tray.length) }).map((_, i) => (
        <div key={`empty-${i}`} className="tray-empty"
             style={{ width: 72, height: 72, borderRadius: 14, border: `2px dashed ${tokens.gridDot}` }} />
      ))}
      <button className="tray-refill ml-auto px-4 py-2 rounded-full font-medium"
              style={{ background: tokens.topBarBg, color: tokens.textPrimary }}
              onClick={refill}>
        Refill
      </button>
    </div>
  );
}
```

(Flick-to-discard gesture lands in Task 15; double-click is a temporary stand-in for desktop testing.)

- [ ] **Step 3: Wire into App and bootstrap a session**

`src/App.tsx`:

```tsx
import { useEffect } from 'react';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';
import { useStore } from './state/store';
import { Tray } from './components/Tray';

function Inner() {
  const { tokens } = useTheme();
  const initSession = useStore(s => s.initSession);
  useEffect(() => { initSession({ trayCapacity: 8, repeatPoolSize: 5 }); }, [initSession]);
  return (
    <div className="app-root min-h-screen" style={{ background: tokens.canvasBg, color: tokens.textPrimary }}>
      <div className="canvas-placeholder grid place-items-center h-screen">canvas goes here</div>
      <Tray />
    </div>
  );
}

export default function App() {
  return <ThemeProvider><Inner /></ThemeProvider>;
}
```

- [ ] **Step 4: Tray test (failing first)**

`tests/components/Tray.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tray } from '../../src/components/Tray';
import { useStore } from '../../src/state/store';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

describe('<Tray>', () => {
  beforeEach(() => {
    useStore.getState().initSession({ trayCapacity: 8, repeatPoolSize: 5 });
  });

  it('renders one button per tray tile', () => {
    render(<ThemeProvider><Tray /></ThemeProvider>);
    expect(screen.getAllByRole('button', { name: /tray tile/i })).toHaveLength(8);
  });

  it('refill draws back to capacity after discard', async () => {
    render(<ThemeProvider><Tray /></ThemeProvider>);
    const slots = screen.getAllByRole('button', { name: /tray tile/i });
    await userEvent.dblClick(slots[0]);
    expect(screen.getAllByRole('button', { name: /tray tile/i })).toHaveLength(7);
    await userEvent.click(screen.getByRole('button', { name: /refill/i }));
    expect(screen.getAllByRole('button', { name: /tray tile/i })).toHaveLength(8);
  });
});
```

- [ ] **Step 5: Run**

```bash
npx vitest run tests/components/Tray.test.tsx
# Expected: 2 passed
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(tray): bottom tray with refill + temporary dblclick discard

Renders one slot per tray tile, empty placeholders to capacity, and a
Refill button. Flick-to-discard gesture lands in M15; for now
double-click triggers the discard reducer so we can test the flow."
```

---

## Task 6 — M6: Canvas pan/zoom + drag-to-place

**Files:**
- Create: `src/components/Canvas.tsx`
- Modify: `src/App.tsx`, `src/state/store.ts` (drag-and-drop coordination state)

- [ ] **Step 1: Canvas with viewport transform**

`src/components/Canvas.tsx`:

```tsx
import { useRef, useState, type PointerEvent as RPE, type WheelEvent } from 'react';
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { Tile } from './Tile';
import { cellKey, type Cell } from '../graph/types';

const CELL = 96; // px per cell at zoom 1

export function Canvas() {
  const { tokens } = useTheme();
  const tiles = useStore(s => s.tiles);
  const byCell = useStore(s => s.byCell);
  const startTileId = useStore(s => s.startTileId);
  const ref = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ x: number; y: number } | null>(null);

  function onPointerDown(e: RPE<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('.songtile')) return; // don't pan when grabbing a tile
    drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: RPE<HTMLDivElement>) {
    if (!drag.current) return;
    setPan({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
  }
  function onPointerUp() { drag.current = null; }
  function onWheel(e: WheelEvent<HTMLDivElement>) {
    const next = Math.min(2.5, Math.max(0.4, zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
    setZoom(next);
  }

  function clientToCell(cx: number, cy: number): Cell {
    const r = ref.current!.getBoundingClientRect();
    const lx = (cx - r.left - pan.x) / zoom;
    const ly = (cy - r.top  - pan.y) / zoom;
    return { x: Math.floor(lx / CELL), y: Math.floor(ly / CELL) };
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/songtile-id');
    if (!id) return;
    const cell = clientToCell(e.clientX, e.clientY);
    useStore.getState().placeTileOnCell(id, cell);
  }

  return (
    <div
      ref={ref}
      className="canvas-root relative overflow-hidden h-screen"
      style={{ background: tokens.canvasBg, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onDragOver={e => e.preventDefault()}
      onDrop={onDrop}
    >
      <div className="canvas-world absolute origin-top-left"
           style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        {Object.values(tiles).filter(t => t.cell).map(t => (
          <div key={t.id} className="placed-tile absolute"
               style={{ left: t.cell!.x * CELL, top: t.cell!.y * CELL }}>
            <Tile tile={t} size={CELL} />
            {t.id === startTileId && <span className="start-halo" /* styled in Task 7 */ />}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Make Tray tiles draggable**

In `src/components/Tray.tsx`, change each tray slot:

```tsx
<button
  key={id}
  className="tray-slot"
  draggable
  onDragStart={e => e.dataTransfer.setData('text/songtile-id', id)}
  onDoubleClick={() => discard(id)}
  aria-label="tray tile"
>
  <Tile tile={tiles[id]} size={72} />
</button>
```

- [ ] **Step 3: Mount Canvas in App**

`src/App.tsx` — replace the `canvas-placeholder` div with `<Canvas />`:

```tsx
import { Canvas } from './components/Canvas';
// …
<div className="app-root min-h-screen" style={{ background: tokens.canvasBg, color: tokens.textPrimary }}>
  <Canvas />
  <Tray />
</div>
```

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
# Drag a tray tile onto the canvas. Verify it lands at the cursor cell.
# Drag empty space to pan; scroll-wheel to zoom.
# Drop several tiles — they should snap to a grid.
```

(Adjacency enforcement comes in Task 7; for now any cell is accepted.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(canvas): pan/zoom + drag tray tiles onto canvas cells

Tile grid snaps at 96px cells. Pan via empty-space drag, zoom via
wheel, place via drag-and-drop using setData('text/songtile-id').
Adjacency rules and endpoint detection arrive in M7."
```

---

## Task 7 — M7: Adjacency rules, endpoint retrieval, halo'd start

**Files:**
- Create: `src/graph/adjacency.ts`
- Modify: `src/state/store.ts`, `src/components/Canvas.tsx`, `src/components/Tile.tsx`
- Test: `tests/graph/adjacency.test.ts`

- [ ] **Step 1: Adjacency module — failing test**

`tests/graph/adjacency.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { neighbors, isEndpoint, isIntersection, isAdjacentToGraph, wouldDisconnect } from '../../src/graph/adjacency';
import type { Tile } from '../../src/graph/types';

const t = (id: string, x: number, y: number): Tile =>
  ({ id, cell: { x, y }, kind: 'note', pitch: 60, bass: false } as Tile);

describe('adjacency', () => {
  it('finds orthogonal neighbors', () => {
    const tiles = { a: t('a',0,0), b: t('b',1,0), c: t('c',0,1) };
    const byCell = { '0,0':'a','1,0':'b','0,1':'c' };
    expect(neighbors('a', tiles, byCell).sort()).toEqual(['b','c']);
  });
  it('endpoints have exactly one neighbor', () => {
    const tiles = { a: t('a',0,0), b: t('b',1,0) };
    const byCell = { '0,0':'a','1,0':'b' };
    expect(isEndpoint('a', tiles, byCell)).toBe(true);
  });
  it('intersections have 3+ neighbors', () => {
    const tiles = { a: t('a',0,0), b: t('b',1,0), c: t('c',-1,0), d: t('d',0,1), e: t('e',0,-1) };
    const byCell = { '0,0':'a','1,0':'b','-1,0':'c','0,1':'d','0,-1':'e' };
    expect(isIntersection('a', tiles, byCell)).toBe(true);
  });
  it('isAdjacentToGraph: empty graph accepts any cell', () => {
    expect(isAdjacentToGraph({ x: 5, y: 7 }, {}, {})).toBe(true);
  });
  it('wouldDisconnect is true for non-endpoint removal', () => {
    const tiles = { a: t('a',0,0), b: t('b',1,0), c: t('c',2,0) };
    const byCell = { '0,0':'a','1,0':'b','2,0':'c' };
    expect(wouldDisconnect('b', tiles, byCell)).toBe(true);
    expect(wouldDisconnect('a', tiles, byCell)).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npx vitest run tests/graph/adjacency.test.ts
# Expected: FAIL — module './adjacency' not found
```

- [ ] **Step 3: Implement adjacency**

`src/graph/adjacency.ts`:

```ts
import type { Cell, Tile, TileId } from './types';
import { cellKey } from './types';

const DIRS: Cell[] = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];

export function neighbors(id: TileId, tiles: Record<TileId, Tile>, byCell: Record<string, TileId>): TileId[] {
  const t = tiles[id];
  if (!t?.cell) return [];
  const out: TileId[] = [];
  for (const d of DIRS) {
    const nid = byCell[cellKey({ x: t.cell.x + d.x, y: t.cell.y + d.y })];
    if (nid) out.push(nid);
  }
  return out;
}

export const isEndpoint     = (id: TileId, tiles: Record<TileId, Tile>, byCell: Record<string, TileId>) =>
  neighbors(id, tiles, byCell).length === 1;
export const isIntersection = (id: TileId, tiles: Record<TileId, Tile>, byCell: Record<string, TileId>) =>
  neighbors(id, tiles, byCell).length >= 3;

export function isAdjacentToGraph(cell: Cell, tiles: Record<TileId, Tile>, byCell: Record<string, TileId>): boolean {
  if (Object.keys(byCell).length === 0) return true;
  if (byCell[cellKey(cell)]) return false; // already occupied
  for (const d of DIRS) {
    if (byCell[cellKey({ x: cell.x + d.x, y: cell.y + d.y })]) return true;
  }
  return false;
}

// True iff removing `id` would split the graph into 2+ components.
export function wouldDisconnect(id: TileId, tiles: Record<TileId, Tile>, byCell: Record<string, TileId>): boolean {
  const ns = neighbors(id, tiles, byCell);
  if (ns.length <= 1) return false; // endpoint or isolated
  // BFS from ns[0] over the graph excluding `id`. If we don't reach all of ns, removing splits.
  const visited = new Set<TileId>([ns[0]]);
  const stack = [ns[0]];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const n of neighbors(cur, tiles, byCell)) {
      if (n === id || visited.has(n)) continue;
      visited.add(n); stack.push(n);
    }
  }
  return ns.some(n => !visited.has(n));
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npx vitest run tests/graph/adjacency.test.ts
# Expected: 5 passed
```

- [ ] **Step 5: Enforce adjacency on placement**

In `src/state/store.ts`, modify `placeTileOnCell`:

```ts
import { isAdjacentToGraph } from '../graph/adjacency';
// …
placeTileOnCell(id, cell) {
  const s = get();
  if (!s.tiles[id] || s.byCell[cellKey(cell)]) return; // unknown tile or cell occupied
  if (!isAdjacentToGraph(cell, s.tiles, s.byCell)) return; // rule: must touch existing graph
  const tile = s.tiles[id];
  set({
    tiles: { ...s.tiles, [id]: { ...tile, cell } },
    tray: s.tray.filter(x => x !== id),
    byCell: { ...s.byCell, [cellKey(cell)]: id },
    startTileId: s.startTileId ?? id,
  });
},
```

- [ ] **Step 6: Endpoint-only retrieval + halo fallback**

```ts
import { isEndpoint, wouldDisconnect } from '../graph/adjacency';
// …
returnTileFromCanvas(id) {
  const s = get();
  const tile = s.tiles[id];
  if (!tile?.cell) return;
  if (wouldDisconnect(id, s.tiles, s.byCell)) return;       // not an endpoint → block
  const key = cellKey(tile.cell);
  const { [key]: _gone, ...byCell } = s.byCell;
  let startTileId = s.startTileId;
  if (startTileId === id) {
    // Fallback: lowest (y, x) endpoint among the remaining graph.
    const remaining = Object.values(s.tiles).filter(t => t.cell && t.id !== id) as Tile[];
    const survivingByCell = byCell;
    const candidates = remaining
      .filter(t => isEndpoint(t.id, { ...s.tiles, [id]: { ...tile, cell: null } }, survivingByCell))
      .sort((a, b) => (a.cell!.y - b.cell!.y) || (a.cell!.x - b.cell!.x));
    startTileId = candidates[0]?.id ?? null;
  }
  set({
    tiles: { ...s.tiles, [id]: { ...tile, cell: null } },
    byCell,
    tray: [...s.tray, id],
    startTileId,
  });
},
```

- [ ] **Step 7: Halo on the start tile**

In `src/components/Canvas.tsx`, replace the `start-halo` placeholder with:

```tsx
{t.id === startTileId && (
  <div
    className="start-halo absolute pointer-events-none"
    style={{
      inset: -6, borderRadius: 18,
      boxShadow: `0 0 0 3px ${tokens.tilePlayhead}`,
    }}
  />
)}
```

Also in `Canvas.tsx`, on a tap that lands on an endpoint tile, call `setStartTile(id)`:

```tsx
function onTileClick(id: string) {
  const s = useStore.getState();
  if (isEndpoint(id, s.tiles, s.byCell)) s.setStartTile(id);
}
// …
<div ... onClick={() => onTileClick(t.id)}>
```

- [ ] **Step 8: Manual verify**

```bash
npm run dev
# 1. Place a tile — it should get a halo (auto-default start).
# 2. Place additional tiles only adjacent to existing graph.
# 3. Tap another endpoint — halo should move.
# 4. Try to remove a non-endpoint via the in-progress retrieve — should be blocked.
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(graph): adjacency rules + endpoint retrieval + halo'd start

Placement requires orthogonal adjacency to the existing graph. Tiles
can only be returned to tray if removing them won't split the graph
(endpoints only). Tapping an endpoint moves the halo'd start tile;
when the start tile is removed the halo falls back deterministically
to the lowest (y,x) endpoint."
```

---

## Task 8 — M8: Segment computation

**Files:**
- Create: `src/graph/segments.ts`
- Test: `tests/graph/segments.test.ts`

- [ ] **Step 1: Failing test**

`tests/graph/segments.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeSegments } from '../../src/graph/segments';
import type { Tile } from '../../src/graph/types';

const note = (id: string, x: number, y: number): Tile =>
  ({ id, cell: { x, y }, kind: 'note', pitch: 60, bass: false } as Tile);

describe('computeSegments', () => {
  it('returns one segment for a simple line, in walk order', () => {
    const tiles = { a: note('a',0,0), b: note('b',1,0), c: note('c',2,0) };
    const byCell = { '0,0':'a','1,0':'b','2,0':'c' };
    const segs = computeSegments('a', tiles, byCell);
    expect(segs).toHaveLength(1);
    expect(segs[0].tiles).toEqual(['a','b','c']);
  });
  it('forks into 3 segments at a + intersection', () => {
    const tiles = {
      a: note('a',0,0), c: note('c',1,0),  // start arm
      b: note('b',2,0),                    // intersection
      n: note('n',2,-1), e: note('e',3,0), s: note('s',2,1),
    };
    const byCell = { '0,0':'a','1,0':'c','2,0':'b','2,-1':'n','3,0':'e','2,1':'s' };
    const segs = computeSegments('a', tiles, byCell);
    expect(segs).toHaveLength(4);                              // start arm + 3 outgoing
    expect(segs[0].tiles).toEqual(['a','c','b']);              // start → intersection inclusive
    const arms = segs.slice(1).map(s => s.tiles).sort();
    expect(arms).toEqual([['e'], ['n'], ['s']].sort());
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npx vitest run tests/graph/segments.test.ts
# Expected: FAIL — module './segments' not found
```

- [ ] **Step 3: Implement**

`src/graph/segments.ts`:

```ts
import type { Tile, TileId } from './types';
import { neighbors } from './adjacency';

export interface Segment {
  rootId: TileId;        // first tile in walk direction
  tiles: TileId[];       // ordered in walk direction; ends at endpoint or intersection inclusive
  endsAtIntersection: boolean;
}

export function computeSegments(
  startId: TileId,
  tiles: Record<TileId, Tile>,
  byCell: Record<string, TileId>,
): Segment[] {
  const out: Segment[] = [];
  const visited = new Set<TileId>();
  // BFS over (segmentRoot, prevId) frontier.
  const frontier: Array<{ root: TileId; prev: TileId | null }> = [{ root: startId, prev: null }];

  while (frontier.length) {
    const { root, prev } = frontier.shift()!;
    if (visited.has(root)) continue;

    const seg: TileId[] = [];
    let cur = root;
    let last = prev;
    while (true) {
      visited.add(cur);
      seg.push(cur);
      const ns = neighbors(cur, tiles, byCell).filter(n => n !== last);
      if (ns.length === 1) {
        // straight continuation
        last = cur; cur = ns[0];
        if (visited.has(cur)) break; // loop back to graph (shouldn't happen on tree)
      } else if (ns.length === 0) {
        // endpoint
        out.push({ rootId: root, tiles: seg, endsAtIntersection: false });
        break;
      } else {
        // intersection: include this tile in the current seg (already pushed),
        // then enqueue each outgoing branch as a new segment
        out.push({ rootId: root, tiles: seg, endsAtIntersection: true });
        for (const branch of ns) frontier.push({ root: branch, prev: cur });
        break;
      }
    }
  }
  return out;
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npx vitest run tests/graph/segments.test.ts
# Expected: 2 passed
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(graph): compute walk-order segments from start tile

BFS over (root, prev) frontier: each segment runs from its root in
walk direction until it hits an endpoint or an intersection. At
intersections the intersection tile is included as the last tile of
the incoming segment, then each outgoing branch is enqueued as the
root of a new segment."
```

---

## Task 9 — M9: Sequential playback (rolling 2s look-ahead)

**Files:**
- Create: `src/playback/events.ts`, `src/playback/playhead.ts`, `src/playback/scheduler.ts`
- Modify: `src/state/store.ts` (add `play()` / `stop()`)
- Test: `tests/playback/playhead.test.ts`, `tests/playback/scheduler.test.ts`

- [ ] **Step 1: Event types**

`src/playback/events.ts`:

```ts
export interface ScheduledNote { midi: number; when: number; duration: number; velocity: number }
export type ScheduleEmit = (n: ScheduledNote) => void;
```

- [ ] **Step 2: Playhead test (sequential only) — failing**

`tests/playback/playhead.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { advancePlayhead } from '../../src/playback/playhead';
import { computeSegments } from '../../src/graph/segments';
import type { Tile } from '../../src/graph/types';

const n = (id: string, x: number, y: number, pitch = 60): Tile =>
  ({ id, cell: { x, y }, kind: 'note', pitch, bass: false } as Tile);

describe('advancePlayhead — sequential', () => {
  it('emits one note per tile per beat in order', () => {
    const tiles = { a: n('a',0,0,60), b: n('b',1,0,62), c: n('c',2,0,64) };
    const byCell = { '0,0':'a','1,0':'b','2,0':'c' };
    const segs = computeSegments('a', tiles, byCell);
    const settings = {};   // empty → use defaults (sequential)
    const beatSec = 0.5;   // 120 BPM

    const events: any[] = [];
    advancePlayhead({
      segments: segs, segmentSettings: settings, tiles,
      startTime: 1.0, beatSec,
      windowEnd: 1.0 + 5 * beatSec,
      emit: e => events.push(e),
    });

    expect(events.map(e => [e.midi, e.when])).toEqual([
      [60, 1.0], [62, 1.5], [64, 2.0],
    ]);
  });
});
```

- [ ] **Step 3: Run — expect failure**

```bash
npx vitest run tests/playback/playhead.test.ts
# Expected: FAIL — module './playhead' not found
```

- [ ] **Step 4: Implement playhead (sequential-only for now)**

`src/playback/playhead.ts`:

```ts
import type { Segment } from '../graph/segments';
import type { Tile, TileId, SegmentSettings } from '../graph/types';
import type { ScheduleEmit } from './events';

interface Args {
  segments: Segment[];
  segmentSettings: Record<TileId, SegmentSettings>;
  tiles: Record<TileId, Tile>;
  startTime: number;     // audio context time of beat 0
  beatSec: number;
  windowEnd: number;     // emit no event with `when` >= this
  emit: ScheduleEmit;
}

export function advancePlayhead({ segments, segmentSettings, tiles, startTime, beatSec, windowEnd, emit }: Args) {
  // Each segment has its own beat offset. The first segment starts at beat 0;
  // segments produced by an intersection inherit the beat at which their
  // parent intersection fired. Branches and chord-mode handling land in
  // M10 / M11; for M9 we assume one chain.
  if (segments.length === 0) return;
  const seg = segments[0];
  const mode = segmentSettings[seg.rootId]?.mode ?? 'sequential';
  if (mode !== 'sequential') return; // chord modes: M11

  for (let i = 0; i < seg.tiles.length; i++) {
    const t = tiles[seg.tiles[i]];
    if (t.kind !== 'note') continue;
    const when = startTime + i * beatSec;
    if (when >= windowEnd) return;
    emit({ midi: t.pitch, when, duration: beatSec * 0.95, velocity: 0.8 });
  }
}
```

- [ ] **Step 5: Run — expect pass**

```bash
npx vitest run tests/playback/playhead.test.ts
# Expected: 1 passed
```

- [ ] **Step 6: Scheduler with rolling 2s window**

`src/playback/scheduler.ts`:

```ts
import { advancePlayhead } from './playhead';
import type { Segment } from '../graph/segments';
import type { Tile, TileId, SegmentSettings } from '../graph/types';
import type { ScheduleEmit } from './events';

const LOOKAHEAD_SEC = 2.0;
const TICK_MS = 25;

export interface SchedulerDeps {
  now(): number;                       // audio context time
  emit: ScheduleEmit;
  getSnapshot(): {
    segments: Segment[];
    segmentSettings: Record<TileId, SegmentSettings>;
    tiles: Record<TileId, Tile>;
    bpm: number;
  };
}

export function createScheduler(deps: SchedulerDeps) {
  let timer: ReturnType<typeof setInterval> | null = null;
  let startTime = 0;
  let scheduledThrough = 0;
  const seenIds = new Set<string>();   // dedupe events already emitted within the window

  function tick() {
    const t = deps.now();
    const windowEnd = t + LOOKAHEAD_SEC;
    if (windowEnd <= scheduledThrough) return;
    const snap = deps.getSnapshot();
    const beatSec = 60 / snap.bpm;
    advancePlayhead({
      segments: snap.segments, segmentSettings: snap.segmentSettings, tiles: snap.tiles,
      startTime, beatSec, windowEnd,
      emit: ev => {
        const key = `${ev.midi}@${ev.when.toFixed(4)}`;
        if (seenIds.has(key)) return;
        seenIds.add(key);
        deps.emit(ev);
      },
    });
    scheduledThrough = windowEnd;
  }

  return {
    start() {
      startTime = deps.now();
      scheduledThrough = startTime;
      seenIds.clear();
      timer = setInterval(tick, TICK_MS);
      tick();
    },
    stop() {
      if (timer) { clearInterval(timer); timer = null; }
    },
  };
}
```

- [ ] **Step 7: Scheduler test (fake clock)**

`tests/playback/scheduler.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { createScheduler } from '../../src/playback/scheduler';

describe('scheduler', () => {
  it('emits within the rolling window without duplicates', () => {
    let now = 0;
    const out: any[] = [];
    const tiles = { a: { id:'a', cell:{x:0,y:0}, kind:'note', pitch:60, bass:false } } as any;
    const segs  = [{ rootId:'a', tiles:['a'], endsAtIntersection:false }];
    const sch = createScheduler({
      now: () => now,
      emit: e => out.push(e),
      getSnapshot: () => ({ segments: segs, segmentSettings: {}, tiles, bpm: 120 }),
    });
    vi.useFakeTimers();
    sch.start();
    vi.advanceTimersByTime(200);   // a few ticks
    sch.stop();
    expect(out.length).toBe(1);
    expect(out[0].midi).toBe(60);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 8: Run — expect pass**

```bash
npx vitest run tests/playback/scheduler.test.ts
# Expected: 1 passed
```

- [ ] **Step 9: Wire Play/Stop into the store**

In `src/state/store.ts` add:

```ts
import { createScheduler } from '../playback/scheduler';
import { computeSegments } from '../graph/segments';
import { createSongtilesPlayer } from '../audio/songtilesPlayer';
import { createAudioEngine } from '../audio/engine';     // adjust if engine exports differently

let player: ReturnType<typeof createSongtilesPlayer> | null = null;
let scheduler: ReturnType<typeof createScheduler> | null = null;

function ensurePlayer() {
  if (player) return player;
  const engine = createAudioEngine();   // creates AudioContext lazily on first user gesture
  player = createSongtilesPlayer(engine);
  return player;
}

// inside the store body:
play() {
  const s = get();
  if (!s.startTileId) return;
  const p = ensurePlayer();
  scheduler?.stop();
  scheduler = createScheduler({
    now: () => p.now(),
    emit: ev => p.playNote(ev),
    getSnapshot: () => {
      const st = get();
      return {
        segments: computeSegments(st.startTileId!, st.tiles, st.byCell),
        segmentSettings: st.segmentSettings,
        tiles: st.tiles,
        bpm: st.bpm,
      };
    },
  });
  scheduler.start();
  set({ isPlaying: true });
},
stop() {
  scheduler?.stop(); scheduler = null;
  player?.stopAll();
  set({ isPlaying: false });
},
```

- [ ] **Step 10: Add a temporary Play button**

In `src/App.tsx` (replaced properly by TopBar in M11), add a fixed-position Play/Stop button bound to `useStore`'s `play` / `stop` and `isPlaying`.

- [ ] **Step 11: Manual verify**

```bash
npm run dev
# Place 4 tiles in a line, hit Play. Expect a 4-note sequence at the
# tile pitches, one per beat at the default BPM. Hit Stop — silence.
```

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(playback): sequential playback with 2s look-ahead scheduler

A 25ms-tick scheduler walks the start segment in beat-time, emits
notes whose start times fall within [now, now+2s], and dedupes by
(midi,when). Live BPM and tile changes take effect within the next
window. Branches and chord modes follow in M10/M11."
```

---

## Task 10 — M10: Branching playheads at intersections

**Files:**
- Modify: `src/playback/playhead.ts`
- Test: extend `tests/playback/playhead.test.ts`

- [ ] **Step 1: Failing test for fork**

Add to `tests/playback/playhead.test.ts`:

```ts
it('forks into parallel playheads at intersections', () => {
  // a-b-c intersection at c, branches to d and e
  const tiles = {
    a:n('a',0,0,60), b:n('b',1,0,62), c:n('c',2,0,64),
    d:n('d',2,1,65), e:n('e',2,-1,67),
  };
  const byCell = { '0,0':'a','1,0':'b','2,0':'c','2,1':'d','2,-1':'e' };
  const segs = computeSegments('a', tiles, byCell);

  const events: any[] = [];
  advancePlayhead({
    segments: segs, segmentSettings: {}, tiles,
    startTime: 0, beatSec: 0.5,
    windowEnd: 10,
    emit: e => events.push(e),
  });

  // At beat 0,1,2: a,b,c. At beat 3: BOTH d and e (forked).
  const byBeat: Record<number, number[]> = {};
  for (const e of events) {
    const beat = Math.round(e.when / 0.5);
    (byBeat[beat] ||= []).push(e.midi);
  }
  expect(byBeat[0]).toEqual([60]);
  expect(byBeat[1]).toEqual([62]);
  expect(byBeat[2]).toEqual([64]);
  expect(byBeat[3].sort()).toEqual([65, 67]);
});
```

- [ ] **Step 2: Run — expect failure**

```bash
npx vitest run tests/playback/playhead.test.ts
# Expected: 1 of 2 fails (the new fork test)
```

- [ ] **Step 3: Generalise the playhead**

Replace `advancePlayhead` body in `src/playback/playhead.ts`:

```ts
export function advancePlayhead({ segments, segmentSettings, tiles, startTime, beatSec, windowEnd, emit }: Args) {
  // Index segments by root for O(1) lookup of children at an intersection.
  const bySegRoot: Record<string, Segment> = {};
  for (const s of segments) bySegRoot[s.rootId] = s;
  // Find children of a segment that ends at an intersection: any segment whose
  // root equals one of the intersection-tile's neighbors that's not the
  // segment's own previous tile. computeSegments already guarantees that
  // child segments exist as separate Segment entries with rootId = the branch
  // tile, so we can pre-build children by scanning segments whose root is a
  // neighbor of the parent's last tile.
  const children = (parent: Segment): Segment[] => {
    if (!parent.endsAtIntersection) return [];
    const last = parent.tiles[parent.tiles.length - 1];
    return segments.filter(s => s.rootId !== parent.rootId && tilesAreAdjacent(tiles[last], tiles[s.rootId]));
  };

  const startSeg = segments[0];
  const heads: Array<{ seg: Segment; beat: number }> = [{ seg: startSeg, beat: 0 }];

  while (heads.length) {
    const { seg, beat } = heads.shift()!;
    const mode = segmentSettings[seg.rootId]?.mode ?? 'sequential';
    if (mode !== 'sequential') continue; // chord modes added in M11
    for (let i = 0; i < seg.tiles.length; i++) {
      const t = tiles[seg.tiles[i]];
      if (t.kind !== 'note') continue;
      const when = startTime + (beat + i) * beatSec;
      if (when >= windowEnd) return;
      emit({ midi: t.pitch, when, duration: beatSec * 0.95, velocity: 0.8 });
    }
    if (seg.endsAtIntersection) {
      const childBeat = beat + seg.tiles.length; // intersection consumes its own beat (seg.tiles[last])
      for (const c of children(seg)) heads.push({ seg: c, beat: childBeat });
    }
  }
}

function tilesAreAdjacent(a?: { cell: any }, b?: { cell: any }) {
  if (!a?.cell || !b?.cell) return false;
  const dx = Math.abs(a.cell.x - b.cell.x), dy = Math.abs(a.cell.y - b.cell.y);
  return (dx + dy) === 1;
}
```

- [ ] **Step 4: Run — expect both pass**

```bash
npx vitest run tests/playback/playhead.test.ts
# Expected: 2 passed
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(playback): fork playheads in parallel at intersections

When a segment ends at an intersection, the playhead spawns one child
playhead per outgoing branch, all phase-locked to the next beat after
the intersection tile fired."
```

---

## Task 11 — M11: Detail panel + Solid/Arp + hold

**Files:**
- Create: `src/components/DetailPanel.tsx`
- Modify: `src/state/store.ts` (add `setSegmentMode`, `setSegmentHold`, `selectedTileId`), `src/components/Canvas.tsx`, `src/playback/playhead.ts`
- Test: extend `tests/playback/playhead.test.ts`

- [ ] **Step 1: Store — selection + segment-setter actions**

In `src/state/store.ts` add:

```ts
selectedTileId: TileId | null,
selectTile(id: TileId | null) { set({ selectedTileId: id }); },
setSegmentMode(rootId: TileId, mode: SegmentMode) {
  const s = get();
  set({ segmentSettings: { ...s.segmentSettings, [rootId]: { ...(s.segmentSettings[rootId] ?? { segmentRootId: rootId, mode: 'sequential', holdBeats: 1 }), segmentRootId: rootId, mode } } });
},
setSegmentHold(rootId: TileId, holdBeats: 1|2|3|4) {
  const s = get();
  set({ segmentSettings: { ...s.segmentSettings, [rootId]: { ...(s.segmentSettings[rootId] ?? { segmentRootId: rootId, mode: 'sequential', holdBeats: 1 }), segmentRootId: rootId, holdBeats } } });
},
```

- [ ] **Step 2: Failing test — solid chord**

```ts
it('solid chord fires all segment notes at the same beat', () => {
  const tiles = { a:n('a',0,0,60), b:n('b',1,0,64), c:n('c',2,0,67) };
  const byCell = { '0,0':'a','1,0':'b','2,0':'c' };
  const segs = computeSegments('a', tiles, byCell);
  const settings = { a: { segmentRootId:'a', mode:'solid' as const, holdBeats: 2 as const } };

  const events: any[] = [];
  advancePlayhead({
    segments: segs, segmentSettings: settings, tiles,
    startTime: 0, beatSec: 0.5, windowEnd: 10,
    emit: e => events.push(e),
  });
  expect(events.map(e => [e.midi, e.when]).sort()).toEqual([
    [60, 0], [64, 0], [67, 0]
  ]);
  // hold = 2 beats → duration ~ 0.95 * 2 * beatSec
  for (const e of events) expect(e.duration).toBeCloseTo(0.95 * 1.0, 3);
});
```

- [ ] **Step 3: Implement chord modes in playhead**

Update the loop in `advancePlayhead`:

```ts
while (heads.length) {
  const { seg, beat } = heads.shift()!;
  const settings = segmentSettings[seg.rootId];
  const mode = settings?.mode ?? 'sequential';
  const hold = settings?.holdBeats ?? 1;
  let beatsConsumed = 0;

  if (mode === 'sequential') {
    for (let i = 0; i < seg.tiles.length; i++) {
      const t = tiles[seg.tiles[i]];
      if (t.kind !== 'note') continue;
      const when = startTime + (beat + i) * beatSec;
      if (when >= windowEnd) return;
      emit({ midi: t.pitch, when, duration: beatSec * 0.95, velocity: 0.8 });
    }
    beatsConsumed = seg.tiles.length;
  } else if (mode === 'solid' || mode === 'arp') {
    const noteTiles = seg.tiles.map(id => tiles[id]).filter(t => t.kind === 'note');
    const baseWhen = startTime + beat * beatSec;
    if (baseWhen >= windowEnd) return;
    const arpStep = mode === 'arp' ? Math.min(0.04, beatSec / Math.max(noteTiles.length, 1)) : 0;
    noteTiles.forEach((t, i) => {
      emit({
        midi: (t as any).pitch,
        when: baseWhen + i * arpStep,
        duration: beatSec * hold * 0.95,
        velocity: 0.8,
      });
    });
    beatsConsumed = hold;
  }

  if (seg.endsAtIntersection) {
    const childBeat = beat + beatsConsumed;
    for (const c of children(seg)) heads.push({ seg: c, beat: childBeat });
  }
}
```

- [ ] **Step 4: Run — expect all pass**

```bash
npx vitest run tests/playback/playhead.test.ts
# Expected: all tests passing (sequential + fork + solid).
```

- [ ] **Step 5: Detail panel UI**

`src/components/DetailPanel.tsx`:

```tsx
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { computeSegments } from '../graph/segments';

export function DetailPanel() {
  const { tokens } = useTheme();
  const selected = useStore(s => s.selectedTileId);
  const start = useStore(s => s.startTileId);
  const tiles = useStore(s => s.tiles);
  const byCell = useStore(s => s.byCell);
  const settings = useStore(s => s.segmentSettings);
  const setMode = useStore(s => s.setSegmentMode);
  const setHold = useStore(s => s.setSegmentHold);
  if (!selected || !start) return null;

  // Find the segment containing the selected tile.
  const segs = computeSegments(start, tiles, byCell);
  const seg = segs.find(s => s.tiles.includes(selected));
  if (!seg) return null;
  const cur = settings[seg.rootId] ?? { segmentRootId: seg.rootId, mode: 'sequential' as const, holdBeats: 1 as const };

  return (
    <div className="detail-panel fixed bottom-24 left-4 right-4 md:left-auto md:right-4 md:w-80 p-4 rounded-2xl"
         style={{ background: tokens.topBarBg, color: tokens.textPrimary, boxShadow: tokens.tileShadow }}>
      <div className="detail-row mb-3">
        <div className="detail-label text-sm opacity-60 mb-1">Mode</div>
        <div className="detail-mode-buttons flex gap-2">
          {(['sequential','solid','arp'] as const).map(m => (
            <button key={m}
              className={`mode-btn px-3 py-1 rounded-full text-sm ${cur.mode === m ? 'bg-black/10' : ''}`}
              onClick={() => setMode(seg.rootId, m)}>
              {m}
            </button>
          ))}
        </div>
      </div>
      {(cur.mode === 'solid' || cur.mode === 'arp') && (
        <div className="detail-row">
          <div className="detail-label text-sm opacity-60 mb-1">Hold (beats)</div>
          <div className="detail-hold-buttons flex gap-2">
            {[1,2,3,4].map(h => (
              <button key={h}
                className={`hold-btn px-3 py-1 rounded-full text-sm ${cur.holdBeats === h ? 'bg-black/10' : ''}`}
                onClick={() => setHold(seg.rootId, h as 1|2|3|4)}>
                {h}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Wire selection and panel**

- In `Canvas.tsx`, on tile click also call `useStore.getState().selectTile(id)`.
- In `App.tsx`, render `<DetailPanel />` next to `<Tray />`.

- [ ] **Step 7: Manual verify**

```bash
npm run dev
# Build a 5-tile linear strand. Tap any tile → detail panel.
# Switch to Solid; hit Play — all 5 fire on beat 1. Set Hold=3; verify
# the chord sustains 3 beats before any branch continues.
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(playback): solid + arp segment modes with 1..4 beat hold

Detail panel exposes mode (sequential/solid/arp) and hold-length per
segment. Chord modes fire all segment notes at the same audio time
(arp staggers them ≤40ms apart) and hold for holdBeats * beatSec
before downstream branches advance."
```

---

## Task 12 — M12: Bass-mode flip

**Files:**
- Modify: `src/state/store.ts`, `src/components/Tile.tsx`, `src/components/Canvas.tsx`, `src/components/DetailPanel.tsx`, `src/playback/playhead.ts`
- Test: extend `tests/playback/playhead.test.ts`

- [ ] **Step 1: Store action**

```ts
toggleBass(id: TileId) {
  const s = get();
  const t = s.tiles[id];
  if (!t || t.kind !== 'note') return;
  set({ tiles: { ...s.tiles, [id]: { ...t, bass: !t.bass } } });
},
```

- [ ] **Step 2: Failing test — bass register clamp**

```ts
it('bass-flipped tile emits a sustained bass voice clamped to C2..B2', () => {
  // Single segment a,b,c. b is bass-flipped (pitch G5=79).
  const tiles = {
    a:n('a',0,0,60), b:{...n('b',1,0,79), bass:true}, c:n('c',2,0,64),
  };
  const byCell = { '0,0':'a','1,0':'b','2,0':'c' };
  const segs = computeSegments('a', tiles, byCell);
  const events: any[] = [];
  advancePlayhead({ segments: segs, segmentSettings: {}, tiles,
    startTime: 0, beatSec: 0.5, windowEnd: 10, emit: e => events.push(e) });

  // Expect a melody event for b at pitch 79 AND a bass event clamped
  // to MIDI 36..47 with the same pitch class as 79 (G → 43).
  const bass = events.find(e => e.midi === 43);
  expect(bass).toBeTruthy();
  // Bass sustains from beat 1 (when b plays) to end of segment (beat 3 → +2 beats)
  expect(bass!.when).toBeCloseTo(0.5);
  expect(bass!.duration).toBeCloseTo(2 * 0.5 * 0.95, 2);
});
```

- [ ] **Step 3: Implement bass voice in playhead**

Inside the `sequential` branch of `advancePlayhead`:

```ts
let activeBass: { midi: number; startBeat: number } | null = null;
const closeBass = (endBeat: number) => {
  if (!activeBass) return;
  const dur = (endBeat - activeBass.startBeat) * beatSec * 0.95;
  emit({ midi: activeBass.midi, when: startTime + activeBass.startBeat * beatSec, duration: dur, velocity: 0.7 });
  activeBass = null;
};

for (let i = 0; i < seg.tiles.length; i++) {
  const t = tiles[seg.tiles[i]];
  if (t.kind !== 'note') continue;
  const when = startTime + (beat + i) * beatSec;
  if (when >= windowEnd) { closeBass(beat + i); return; }
  emit({ midi: t.pitch, when, duration: beatSec * 0.95, velocity: 0.8 });

  if ((t as any).bass) {
    closeBass(beat + i);                  // close prior bass at this tile
    const pc = ((t as any).pitch % 12 + 12) % 12;
    activeBass = { midi: 36 + pc, startBeat: beat + i }; // clamp to C2..B2
  }
}
closeBass(beat + seg.tiles.length);
```

(For chord modes, bass-flagged tiles inside a chord are treated the same — the segment's first bass-flagged tile sets a bass voice that sustains for the chord's hold length, opened at `baseWhen` and closed at `baseWhen + hold * beatSec`. Add the analogous logic in the `solid`/`arp` branch.)

- [ ] **Step 4: Run — expect pass**

```bash
npx vitest run tests/playback/playhead.test.ts
# Expected: all passing.
```

- [ ] **Step 5: UI affordances**

- In `Tile.tsx` (note branch), if `tile.bass` apply the inverted treatment: swap to `tokens.textPrimary`-based dark background, white text, and render the `↓` arrow overlay (already in M5 placeholder — make it more prominent).
- In `DetailPanel.tsx`, add a Bass toggle button bound to `toggleBass(seg.tiles[firstSelectedTile])` — operate on the actually-selected tile rather than the segment root.
- In `Canvas.tsx`, add long-press detection on a tile (pointer down >450ms without movement >5px) to trigger `toggleBass(id)` directly.

- [ ] **Step 6: Manual verify**

```bash
npm run dev
# Build a 4-tile linear segment. Long-press tile 2 — visual flips.
# Hit Play — hear the melody plus a low sustained bass note in C2..B2
# octave for the duration the playhead is downstream of that tile.
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(playback): bass-mode flip with C2..B2 clamp

Long-press or detail-panel toggle flips a tile to bass mode. While the
playhead is downstream of a bass tile inside its segment, a sustained
voice plays at the same pitch class clamped to MIDI 36..47, on top of
the melody, until the next bass tile or end of segment."
```

---

## Task 13 — M13: Repeat tiles + pool + Petaluma + repeat playback

**Files:**
- Create: `src/constants/petaluma.ts`, `src/components/RepeatPocket.tsx`, `src/graph/repeats.ts`, `public/fonts/Petaluma.woff2`
- Modify: `src/index.css`, `src/components/Tile.tsx`, `src/playback/playhead.ts`, `src/state/store.ts`
- Test: `tests/graph/repeats.test.ts`, extend `tests/playback/playhead.test.ts`

- [ ] **Step 1: Bundle Petaluma**

Download the Petaluma SMuFL font (Steinberg / SMuFL, OFL licensed). Place `Petaluma.woff2` at `public/fonts/`. Append to `src/index.css`:

```css
@font-face {
  font-family: 'Petaluma';
  src: url('/fonts/Petaluma.woff2') format('woff2');
  font-display: block;
}
.petaluma { font-family: 'Petaluma', serif; }
```

`src/constants/petaluma.ts`:

```ts
// SMuFL code points for repeat barlines.
// repeat-start = U+E040; repeat-end = U+E041 (verify against the bundled
// Petaluma metadata.json if visuals look off and adjust here only).
export const PETALUMA_REPEAT_OPEN  = '';
export const PETALUMA_REPEAT_CLOSE = '';
```

- [ ] **Step 2: Repeat tile pool — store actions**

```ts
pullRepeatPair() {
  const s = get();
  if (s.repeatSetsRemaining <= 0) return;
  const openId  = newTileId();
  const closeId = newTileId();
  set({
    tiles: {
      ...s.tiles,
      [openId]:  { id: openId,  cell: null, kind: 'repeat-open',  count: 1 },
      [closeId]: { id: closeId, cell: null, kind: 'repeat-close' },
    },
    tray: [...s.tray, openId, closeId],
    repeatSetsRemaining: s.repeatSetsRemaining - 1,
  });
},
cycleRepeatCount(id: TileId) {
  const s = get();
  const t = s.tiles[id];
  if (!t || t.kind !== 'repeat-open') return;
  const order = [1,2,3,4,'inf' as const,1] as const;
  const next = order[order.indexOf(t.count) + 1];
  set({ tiles: { ...s.tiles, [id]: { ...t, count: next } } });
},
```

- [ ] **Step 3: RepeatPocket UI**

`src/components/RepeatPocket.tsx`:

```tsx
import { useStore } from '../state/store';
import { useTheme } from '../theme/ThemeProvider';
import { PETALUMA_REPEAT_OPEN, PETALUMA_REPEAT_CLOSE } from '../constants/petaluma';

export function RepeatPocket() {
  const { tokens } = useTheme();
  const left = useStore(s => s.repeatSetsRemaining);
  const pull = useStore(s => s.pullRepeatPair);
  return (
    <div className="repeat-pocket fixed top-16 right-4 p-3 rounded-2xl flex items-center gap-2"
         style={{ background: tokens.topBarBg, color: tokens.textPrimary, boxShadow: tokens.tileShadow }}>
      <span className="petaluma text-2xl">{PETALUMA_REPEAT_OPEN}</span>
      <span className="petaluma text-2xl">{PETALUMA_REPEAT_CLOSE}</span>
      <button className="repeat-pull px-3 py-1 rounded-full text-sm"
              onClick={pull} disabled={left <= 0}
              style={{ background: tokens.canvasBg }}>
        Pull set ({left} left)
      </button>
    </div>
  );
}
```

Render `<RepeatPocket />` from `App.tsx`. Update `Tile.tsx` repeat branch to use `petaluma` class and the SMuFL glyphs (with a count badge for `repeat-open` showing `1×`/`2×`/`3×`/`4×`/`∞`).

- [ ] **Step 4: Repeat pairing — failing test**

`tests/graph/repeats.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { findRepeatSpans } from '../../src/graph/repeats';

describe('findRepeatSpans', () => {
  it('matches inner-most pairs along a path; ignores unmatched', () => {
    // Path tiles in order: n1, OPEN(2x), n2, OPEN(3x), n3, CLOSE, n4, CLOSE, n5, OPEN(unmatched)
    const path = [
      { id:'n1', kind:'note' as const },
      { id:'o1', kind:'repeat-open' as const, count: 2 as const },
      { id:'n2', kind:'note' as const },
      { id:'o2', kind:'repeat-open' as const, count: 3 as const },
      { id:'n3', kind:'note' as const },
      { id:'c1', kind:'repeat-close' as const },
      { id:'n4', kind:'note' as const },
      { id:'c2', kind:'repeat-close' as const },
      { id:'n5', kind:'note' as const },
      { id:'o3', kind:'repeat-open' as const, count: 4 as const },
    ];
    const spans = findRepeatSpans(path);
    // Outer span: o1..c2  3 iterations? No — outer is o1 (×2) closes at c2, inner is o2 (×3) closes at c1.
    expect(spans).toEqual([
      { openIndex: 3, closeIndex: 5, count: 3 }, // inner
      { openIndex: 1, closeIndex: 7, count: 2 }, // outer
    ]);
  });
});
```

- [ ] **Step 5: Implement pairing**

`src/graph/repeats.ts`:

```ts
type PathItem = { id: string; kind: 'note' | 'repeat-open' | 'repeat-close'; count?: 1|2|3|4|'inf' };
export interface RepeatSpan { openIndex: number; closeIndex: number; count: 1|2|3|4|'inf' }

export function findRepeatSpans(path: PathItem[]): RepeatSpan[] {
  const stack: number[] = [];
  const out: RepeatSpan[] = [];
  for (let i = 0; i < path.length; i++) {
    if (path[i].kind === 'repeat-open') stack.push(i);
    else if (path[i].kind === 'repeat-close' && stack.length) {
      const open = stack.pop()!;
      out.push({ openIndex: open, closeIndex: i, count: (path[open].count ?? 1) });
    }
  }
  // Sort by openIndex ascending so inner-most pairs come earlier when fully nested.
  return out.sort((a, b) => a.openIndex - b.openIndex);
}
```

(Test expectation in Step 4 sorts inner-first because the inner span starts later but closes earlier — adjust the test or sort to match the playhead's iteration strategy. Settle on **outer-first iteration with inner expansion per iteration**: sort by `openIndex` ascending so outer spans process first; inner spans are re-encountered on each outer iteration.)

- [ ] **Step 6: Run pairing test**

```bash
npx vitest run tests/graph/repeats.test.ts
# Expected: pass after sort agrees with the test ordering.
```

- [ ] **Step 7: Repeat playback in playhead**

Refactor the `sequential` branch of `advancePlayhead` to:

1. Build a flattened `path` of `(tile, mode-specific role)` for the segment.
2. Call `findRepeatSpans(path)`.
3. Iterate the path with a beat counter, but when entering a repeat-open whose pair is found, emit the inner sub-path `count` times before continuing past close (special-case `inf`: emit one iteration's worth of events whose `when` falls in `[startTime + beat*beatSec, windowEnd]`, then bump `beat` accordingly so the next scheduler tick re-enters and emits the next iteration).
4. Open / close repeat tiles consume 0 beats; skip them when no pair found.

(Implementation runs ~40 lines; keep it confined to the playhead module.)

- [ ] **Step 8: Failing test — finite repeat**

```ts
it('repeats a section count times for finite counts', () => {
  // tiles in order: a, OPEN(×3), b, CLOSE, c — expect a,b,b,b,c at beats 0,1,2,3,4
  // (open + close consume zero beats)
});
```

Implement the test, then verify the existing playhead handles it (extend if not). Add a second test for `count: 'inf'` that asserts the iteration window keeps emitting on subsequent windowEnds.

- [ ] **Step 9: Run — expect pass**

```bash
npx vitest run tests/playback tests/graph/repeats.test.ts
# Expected: all passing.
```

- [ ] **Step 10: Manual verify**

```bash
npm run dev
# Pull a repeat set, place open and close along a strand, set ×3, hit Play.
# Hear the section between them three times.
```

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat(repeats): pool, Petaluma glyphs, and 1×/2×/3×/4×/∞ playback

Repeat-Open and Repeat-Close are wildcard tiles pulled from a side
pocket sized by repeat-pool difficulty. Open/Close consume zero beats
and are silently skipped if unpaired. Finite counts emit the looped
events count times; infinite counts re-emit on each scheduler window."
```

---

## Task 14 — M14: Save / Load JSON + localStorage autosave

**Files:**
- Create: `src/state/persistence.ts`
- Modify: `src/state/store.ts`, `src/components/TopBar.tsx`
- Test: `tests/state/persistence.test.ts`

- [ ] **Step 1: SessionFile schema + serialise/deserialise — failing test**

```ts
import { describe, it, expect } from 'vitest';
import { serialiseSession, deserialiseSession } from '../../src/state/persistence';

describe('persistence', () => {
  it('roundtrips a minimal session preserving canvas/tray/deck/discardedCount', () => {
    const state = {
      tiles: {
        a: { id:'a', cell:{x:0,y:0}, kind:'note', pitch:60, bass:false },
        b: { id:'b', cell:null,      kind:'note', pitch:62, bass:false },
      },
      byCell: { '0,0':'a' },
      startTileId: 'a',
      segmentSettings: {},
      tray: ['b'],
      deck: [],
      discardedCount: 0,
      trayCapacity: 4 as const,
      repeatPoolSize: 3 as const,
      repeatSetsRemaining: 3,
      bpm: 96, patchId: 'piano', isPlaying: false,
    };
    const json = serialiseSession(state);
    const back = deserialiseSession(JSON.parse(json));
    expect(back.tiles.a.cell).toEqual({x:0,y:0});
    expect(back.tray).toEqual(['b']);
    expect(back.startTileId).toBe('a');
  });

  it('rejects payloads with mismatched tile count invariant', () => {
    expect(() => deserialiseSession({
      version: 1, savedAt: '', bpm: 96, patchId: 'piano',
      trayCapacity: 4, repeatPoolSize: 3, repeatSetsRemaining: 3,
      startTileId: null, tiles: {}, placements: { canvas: [], tray: [], deck: [] },
      discardedCount: 999, segmentSettings: {},
    } as any)).toThrow();
  });
});
```

- [ ] **Step 2: Implement persistence module**

`src/state/persistence.ts`:

```ts
import type { AppState } from './store';
import type { Tile, TileId, SegmentSettings } from '../graph/types';

export interface SessionFile {
  version: 1;
  savedAt: string;
  bpm: number;
  patchId: string;
  trayCapacity: AppState['trayCapacity'];
  repeatPoolSize: AppState['repeatPoolSize'];
  repeatSetsRemaining: number;
  startTileId: TileId | null;
  tiles: Record<TileId, Tile>;
  placements: { canvas: TileId[]; tray: TileId[]; deck: TileId[] };
  discardedCount: number;
  segmentSettings: Record<TileId, SegmentSettings>;
}

export function serialiseSession(s: Pick<AppState,
  'tiles'|'startTileId'|'tray'|'deck'|'discardedCount'|'trayCapacity'|'repeatPoolSize'|'repeatSetsRemaining'|'bpm'|'patchId'|'segmentSettings'>): string {
  const canvas = Object.values(s.tiles).filter(t => t.cell).map(t => t.id);
  const file: SessionFile = {
    version: 1, savedAt: new Date().toISOString(),
    bpm: s.bpm, patchId: s.patchId,
    trayCapacity: s.trayCapacity, repeatPoolSize: s.repeatPoolSize,
    repeatSetsRemaining: s.repeatSetsRemaining,
    startTileId: s.startTileId,
    tiles: s.tiles,
    placements: { canvas, tray: s.tray, deck: s.deck },
    discardedCount: s.discardedCount,
    segmentSettings: s.segmentSettings,
  };
  return JSON.stringify(file, null, 2);
}

export function deserialiseSession(raw: unknown): SessionFile & { byCell: Record<string, TileId> } {
  const f = raw as SessionFile;
  if (f?.version !== 1) throw new Error('Unsupported session version');
  const canvasCount = f.placements.canvas.length;
  const total = canvasCount + f.placements.tray.length + f.placements.deck.length + f.discardedCount;
  // Note tiles only count toward the 144 invariant; repeat tiles live in a separate pool.
  const noteTiles = Object.values(f.tiles).filter(t => t.kind === 'note');
  if (noteTiles.length + f.discardedCount > 144) {
    throw new Error('Invariant violated: note tile total exceeds 144');
  }
  // Rebuild byCell from tiles[].cell.
  const byCell: Record<string, TileId> = {};
  for (const t of Object.values(f.tiles)) {
    if (t.cell) byCell[`${t.cell.x},${t.cell.y}`] = t.id;
  }
  return Object.assign(f, { byCell });
}
```

- [ ] **Step 3: Run — expect pass**

```bash
npx vitest run tests/state/persistence.test.ts
# Expected: 2 passed
```

- [ ] **Step 4: Store actions**

```ts
saveToFile() {
  const s = get();
  const json = serialiseSession(s);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
  a.href = url; a.download = `songtiles-${stamp}.json`; a.click();
  URL.revokeObjectURL(url);
},
loadFromFile(file: File) {
  return file.text().then(txt => {
    const f = deserialiseSession(JSON.parse(txt));
    set({
      tiles: f.tiles, byCell: f.byCell,
      startTileId: f.startTileId, segmentSettings: f.segmentSettings,
      tray: f.placements.tray, deck: f.placements.deck, discardedCount: f.discardedCount,
      trayCapacity: f.trayCapacity, repeatPoolSize: f.repeatPoolSize,
      repeatSetsRemaining: f.repeatSetsRemaining,
      bpm: f.bpm, patchId: f.patchId, isPlaying: false,
    });
  });
},
```

- [ ] **Step 5: LocalStorage autosave**

In `store.ts`, after every `set(...)` mutation that changes core state (use `useStore.subscribe` once at module load):

```ts
useStore.subscribe(state => {
  try { localStorage.setItem('songtiles.autosave', serialiseSession(state)); } catch {}
});
```

On app boot, before `initSession`, attempt to read `localStorage.getItem('songtiles.autosave')` and call `deserialiseSession` + apply if valid. Skip `initSession` in that case.

- [ ] **Step 6: TopBar buttons**

Add Save / Load buttons to `TopBar.tsx` (Load opens a hidden file input). Wire to the store actions.

- [ ] **Step 7: Manual verify**

```bash
npm run dev
# Build a graph. Click Save → file downloads.
# Reload → autosave restores graph.
# Click Reset → confirm → graph cleared. Click Load → pick downloaded file → graph restored.
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(persistence): SessionFile JSON save/load + localStorage autosave

Explicit deck array in the saved payload so deck contents and draw
order are deterministic on reload, with an invariant check on note
tile totals. Autosave runs on every store mutation; manual Save
triggers a download, manual Load reads a file and replaces state."
```

---

## Task 15 — M15: Setup modal, mobile polish, PWA manifest

**Files:**
- Create: `src/components/SetupModal.tsx`, `public/manifest.webmanifest`, `public/icons/{192,512}.png`
- Modify: `src/components/Tray.tsx`, `src/App.tsx`, `index.html`

- [ ] **Step 1: Setup modal**

`src/components/SetupModal.tsx` — first-run modal with two segmented controls (tray capacity 4/6/8/9/10/11/12, repeat-pool 3/5/8/12) and a Start button that calls `initSession({trayCapacity, repeatPoolSize})` and stores `localStorage.songtiles.firstRunDone = 'yes'`. Mount in `App.tsx` and render only when `firstRunDone` is missing AND there is no autosaved session.

- [ ] **Step 2: Flick-to-discard**

Replace the temporary `onDoubleClick` discard with pointer gesture handling on each tray slot:

```tsx
function useFlickToDiscard(id: string) {
  const discard = useStore(s => s.discardTrayTile);
  const start = useRef<{ x: number; t: number } | null>(null);
  return {
    onPointerDown: (e: React.PointerEvent) => {
      start.current = { x: e.clientX, t: performance.now() };
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (!start.current) return;
      const dx = e.clientX - start.current.x;
      const dt = performance.now() - start.current.t;
      start.current = null;
      const speed = Math.abs(dx) / Math.max(dt, 1);
      if (Math.abs(dx) > 80 && speed > 0.4) discard(id);
    },
  };
}
```

Apply the spread to each tray slot and remove `onDoubleClick`. Animate the slot translating with `dx` while dragging for tactile feedback.

- [ ] **Step 3: Long-press for bass**

In `Canvas.tsx`, on each rendered tile add a pointer-down + setTimeout(450ms) handler that fires `toggleBass(id)` if no movement >5px occurred and pointer is still down.

- [ ] **Step 4: PWA manifest**

`public/manifest.webmanifest`:

```json
{
  "name": "Songtiles",
  "short_name": "Songtiles",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#FAF7F2",
  "theme_color": "#FAF7F2",
  "icons": [
    { "src": "/icons/192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

In `index.html` add inside `<head>`:

```html
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#FAF7F2" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
```

Generate or place 192/512 PNG icons in `public/icons/` (a simple flat domino mark on the canvas-bg colour is fine for v1).

- [ ] **Step 5: Manual mobile QA**

```bash
npm run dev   # served on 0.0.0.0:5173
# Open http://<dev-machine-ip>:5173 on a real phone.
# Verify: pinch-zoom canvas, drag-to-place, flick-to-discard, long-press
# bass flip, halo on tap-endpoint, Play sounds, light/dark follows OS,
# Add-to-home-screen yields a standalone PWA shell.
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(mobile): setup modal, flick-to-discard, long-press bass, PWA

First-run modal selects tray capacity and repeat-pool size; tray
slots support a velocity-based flick-to-discard gesture in either
direction; long-press on a placed tile toggles bass mode; manifest
plus theme-color makes the app installable as a PWA."
```

---

## Self-review (carried out before this plan was finalised)

- **Spec coverage:** every section of the design (core model, tile semantics, UI/interaction, light/dark, save/load, scheduler, repeats, bass, capacity rule) maps to a task above.
- **Placeholders:** the only intentional placeholders are the dottl colour values in `noteColors.ts` (the engineer must paste from the source file at the path noted) — flagged in the step text. No other TBDs.
- **Type consistency:** `SegmentSettings`, `Tile`, `Pitch`, `TileId`, `RepeatPoolSize`, `TrayCapacity` defined once in `src/graph/types.ts` and reused.
- **Scope check:** v1 fits one plan; nothing here belongs in a separate sub-project.

## Out-of-scope for v1 (do not implement)

- Multiple disconnected graphs / multi-canvas projects
- Cloud save / sharing
- MIDI export
- Audio recording / export
- Undo/redo (beyond browser-tab autosave)
