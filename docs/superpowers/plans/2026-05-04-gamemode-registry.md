# GameMode Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalize hardcoded `GameMode = 'explorer' | 'scale'` into a registry where each game mode is a registered module owning its own deck builder and optional setup UI fragment. Built-in `explorer` and `scale` modes preserve current behavior 1:1. After this, proprietary plugins can register new modes (e.g. `blues`, `modal`, `pentatonic`) by calling `registerGameMode(...)`.

**Architecture:** New `src/games/` module mirroring `src/groups/`. A `GameMode` carries `{ id, label, blurb, buildDeck(params), SetupExtras? }`. Mode-specific params (scale root/type for `scale`; nothing for `explorer`) live in a generic `params: unknown` field on the store, replacing the dedicated `scaleRoot`/`scaleType` fields. SetupModal renders the selected mode's `SetupExtras` to capture params at session start. The `createDeck` function in `state/deck.ts` becomes a thin dispatcher.

**Tech Stack:** TypeScript, Zustand, React, Vitest.

**Out of scope:** Plugin loader (still core-registers built-ins), TileKind registry, prompt channel.

---

## File Structure

**Create:**
- `src/games/types.ts` — `GameMode`, `GameModeId`, `BuildDeckContext`
- `src/games/registry.ts` — `registerGameMode`, `getGameMode`, `listGameModes`
- `src/games/builtin/explorer.ts` — explorer mode + `buildDeck`
- `src/games/builtin/scale.ts` — scale mode + `buildDeck` + `SetupExtras` (React)
- `src/games/builtin/index.ts` — registers built-ins
- `src/games/index.ts` — barrel
- `tests/games/registry.test.ts`
- `tests/games/builtin.test.ts`

**Modify:**
- `src/graph/types.ts` — keep `GameMode` as a string-id alias (no longer a fixed union); keep `ScaleRoot`/`ScaleType` (still used by built-in scale params shape)
- `src/state/deck.ts` — remove the explorer/scale switch; dispatch via registry
- `src/state/store.ts` — replace `scaleRoot`, `scaleType` with `gameParams: unknown`; `initSession` takes `(trayCapacity, wildness, gameMode, gameParams)`
- `src/state/persistence.ts` — serialise `gameParams` instead of `scaleRoot`/`scaleType`; with read back-compat
- `src/components/SetupModal.tsx` — derive mode buttons from registry; render selected mode's `SetupExtras`
- `src/main.tsx` — `import './games/builtin'`
- `src/App.tsx` — load-session call site
- `tests/state/deck.test.ts` — update buildDeck test fixtures
- `tests/state/persistence.test.ts` — gameParams roundtrip + legacy decode

---

## Task 1: GameMode interface + registry

**Files:**
- Create: `src/games/types.ts`, `src/games/registry.ts`
- Test: `tests/games/registry.test.ts`

```ts
// src/games/types.ts
import type { ComponentType } from 'react';
import type { Wildness } from '../graph/types';
import type { DeckRecord } from '../state/deck';

export type GameModeId = string;

export interface BuildDeckContext {
  wildness: Wildness;
  /** Mode-specific params, shape defined by the mode itself. */
  params: unknown;
  /** Optional RNG override for tests. */
  rng?: () => number;
}

export interface SetupExtrasProps<P = unknown> {
  params: P;
  setParams: (p: P) => void;
}

export interface GameMode<P = unknown> {
  id: GameModeId;
  label: string;
  blurb: string;
  /** Default params seed when this mode is first selected in the setup UI. */
  defaultParams: P;
  /** Build the shuffled deck for a session in this mode. */
  buildDeck(ctx: BuildDeckContext): DeckRecord;
  /** Optional React fragment rendered in the setup modal when this mode is selected. */
  SetupExtras?: ComponentType<SetupExtrasProps<P>>;
}
```

```ts
// src/games/registry.ts
import type { GameMode, GameModeId } from './types';

const registry = new Map<GameModeId, GameMode<any>>();

export function registerGameMode(mode: GameMode<any>): void {
  if (registry.has(mode.id)) throw new Error(`GameMode "${mode.id}" already registered`);
  registry.set(mode.id, mode);
}
export function getGameMode(id: GameModeId): GameMode<any> | undefined { return registry.get(id); }
export function listGameModes(): GameMode<any>[] { return Array.from(registry.values()); }
export function _resetRegistryForTests(): void { registry.clear(); }
```

Tests: parallel structure to `tests/groups/registry.test.ts` — register/get/list/duplicate/unknown.

Commit: `feat(games): GameMode interface and registry`

---

## Task 2: Built-in `explorer` mode

**Files:** `src/games/builtin/explorer.ts`, `tests/games/builtin.test.ts`

Move the explorer half of `createDeck` into `EXPLORER_MODE.buildDeck`. Params type = `{}` (no params).

Commit: `feat(games): explorer built-in mode`

---

## Task 3: Built-in `scale` mode (deck + SetupExtras)

**Files:** `src/games/builtin/scale.ts`, extend `tests/games/builtin.test.ts`

Move scale-half of `createDeck` into `SCALE_MODE.buildDeck`. Params type:
```ts
export interface ScaleParams { root: ScaleRoot; type: ScaleType }
```
defaultParams: `{ root: 0, type: 'major' }`.
SetupExtras: a React component containing the existing ScaleWheel + major/minor picker, lifted from SetupModal.

Commit: `feat(games): scale built-in mode with setup extras`

---

## Task 4: Builtin index + barrel + main.tsx import

**Files:** `src/games/builtin/index.ts`, `src/games/index.ts`, `src/main.tsx`

Commit: `feat(games): register built-in modes on boot`

---

## Task 5: Refactor `state/deck.ts` to dispatch via registry

`createDeck(opts)` becomes:
```ts
export function createDeck(opts: { mode: GameModeId; wildness: Wildness; params: unknown; rng?: () => number }): DeckRecord {
  const mode = getGameMode(opts.mode);
  if (!mode) throw new Error(`Unknown game mode "${opts.mode}"`);
  return mode.buildDeck({ wildness: opts.wildness, params: opts.params, rng: opts.rng });
}
```

Update `tests/state/deck.test.ts` to use the new shape and `import '../../src/games/builtin'`.

Commit: `refactor(deck): dispatch via game mode registry`

---

## Task 6: Update graph/types.ts

Replace `GameMode` union with id alias, remove `ScaleType`/`SCALE_INTERVALS` from being import-cycled (they move to scale builtin).

```ts
export type GameMode = string; // re-export of GameModeId for back-compat in store
```

Keep `ScaleRoot` and `ScaleType` and `SCALE_INTERVALS` here (the scale builtin imports them).

Commit: `refactor(types): GameMode is now an open string id`

---

## Task 7: Store — replace scaleRoot/scaleType with gameParams

**Modify:** `src/state/store.ts`

- Remove `scaleRoot`, `scaleType` from `AppState` and initial state.
- Add `gameParams: unknown` (initial `{}`).
- `initSession` signature becomes `({ trayCapacity, wildness, gameMode, gameParams })`.
- `createDeck` call passes `params: gameParams`.
- `loadSession` reads `f.gameParams`.

Commit: `refactor(store): gameParams replaces scaleRoot/scaleType`

---

## Task 8: Persistence — gameParams + legacy decode

**Modify:** `src/state/persistence.ts`, `tests/state/persistence.test.ts`

- New SessionFile field: `gameParams: unknown`.
- Drop `scaleRoot`/`scaleType` from `SessionFile` v3.
- Bump version to 3.
- Decode side: if `version === 2`, synthesise `gameParams = { root: f.scaleRoot, type: f.scaleType }` when `gameMode === 'scale'`, else `{}`.

Add a legacy-decode test.

Commit: `refactor(persistence): gameParams field; v2→v3 legacy decode`

---

## Task 9: SetupModal — registry-driven

**Modify:** `src/components/SetupModal.tsx`

Replace hardcoded `MODES` array with `listGameModes()`. State becomes:
```ts
const [gameMode, setGameMode] = useState<GameModeId>(modes[0].id);
const [gameParams, setGameParams] = useState<unknown>(modes[0].defaultParams);
```
When mode changes, reset params to that mode's defaultParams. Render `mode.SetupExtras` if present.

Drop the inline scale picker (it now lives in the scale mode).

Commit: `refactor(setup): SetupModal driven by game mode registry`

---

## Task 10: App.tsx call site + final sweep

- App.tsx loadSession: `gameMode: f.gameMode, gameParams: f.gameParams ?? {}`.
- App.tsx default fallback: `initSession({ trayCapacity: 8, wildness: 'wild', gameMode: 'explorer', gameParams: {} })`.
- Run `npx tsc --noEmit && npx vitest run`. Fix stragglers.
- Visual smoke test: setup modal explorer + scale flows; confirm scale picker works; confirm autosave restores correctly across versions.

Commit: `chore(games): final sweep; full suite green`
