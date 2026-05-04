# Plugin Architecture

Doremino is being refactored to support pluggable game modules. This document tracks what's pluggable today, what's not yet, and the contract each registry exposes.

## Status

| Surface | State | Registry | Built-ins |
|---|---|---|---|
| **Group types** (chord, arp, future loop / random-pick / dice) | ✅ Pluggable | `src/groups/registry.ts` | `chord`, `arp` |
| **Game modes** (deck builder + setup UI fragment) | ✅ Pluggable | `src/games/registry.ts` | `explorer`, `scale` |
| **Tile kinds** (note, repeat, future loop-bracket / dice-tile / random-pick) | ❌ Hardcoded | — | `note`, `repeat` |
| **Playback flow control** (repeat block-loop, future jumps / branches) | ❌ Hardcoded in playhead | — | `repeat` only |
| **Interactive prompts** (sing-the-pitch, dice roll) | ❌ Not implemented | — | — |
| **Plugin loader** (load proprietary bundle at boot/entitlement) | ❌ Not implemented | — | — |

Today, "pluggable" means *registered via a registry that proprietary modules can write to* — but registrations still happen in the OSS core via `src/main.tsx`. The actual loader for external bundles is a future plan.

## Group registry

A **Group** is a set of tiles that fire together in some way when the playhead first hits any tile in the group. Today: chord (stacked simultaneous notes) and arp (cycle through tiles twice over N beats). Future: random-pick (pick one tile from the group), looped-section, etc.

```ts
interface GroupType {
  id: GroupTypeId;
  label: string;
  icon: string;
  color: string;
  onFire(ctx: GroupFireContext): void;  // emits ScheduledNotes
}

interface GroupFireContext {
  group: Group;                         // { id, typeId, tileIds }
  tiles: Record<TileId, Tile>;
  when: number;                         // audio-context time of trigger
  beatSec: number;
  emit: (note: ScheduledNote) => void;
}
```

Register: `registerGroupType(MY_GROUP)`. The toolbar enumerates the registry; the playhead dispatches via `getGroupType(group.typeId).onFire(...)`.

**Limitation:** group types control audio for tiles in the group, but cannot intercept playback flow (e.g. "skip the rest of this segment" or "branch elsewhere"). That's the flow-control extension — future work.

## Game-mode registry

A **GameMode** owns the deck builder and an optional setup UI fragment. Today: explorer (chromatic 144-tile deck) and scale (7-PC × 12-instance deck with a scale picker).

```ts
interface GameMode<P = unknown> {
  id: GameModeId;
  label: string;
  blurb: string;
  defaultParams: P;                              // seeded into setup UI
  buildDeck(ctx: BuildDeckContext): DeckRecord;
  SetupExtras?: ComponentType<SetupExtrasProps<P>>;  // optional setup-modal fragment
}

interface BuildDeckContext {
  wildness: Wildness;
  params: unknown;          // mode-specific shape
  rng?: () => number;       // for tests
}
```

Mode params live as `gameParams: unknown` on the store; they're persisted in session files (v3+) and restored on load. Legacy v2 sessions are auto-decoded.

Register: `registerGameMode(MY_MODE)`. SetupModal enumerates the registry and renders the selected mode's `SetupExtras`. `createDeck()` is now a thin dispatcher.

## What's still hardcoded

These are intentional remaining seams for future plans:

1. **Tile kinds.** `Tile = NoteTile | RepeatTile` is a closed discriminated union. To register new tile kinds (loop tiles, dice tiles, random-pick wildcards), this needs to become an open registry and the tile drag/drop, render, and deck-builder code paths need to consult it.
2. **Flow-control playback.** The playhead has dedicated logic for repeat tiles (block-folding the path into looping sections + tail). Generalizing this to plugin-defined flow control requires an interface where a tile kind exposes a `walk(path, state)` reducer, and is best paired with the next item.
3. **Interactive prompts.** `prompt(payload) -> Promise<result>` channel through the scheduler so games like "sing the pitch" or "roll the dice" can pause playback, surface UI, and resume. This requires making the scheduler tick async and managing a pending-prompt gate.
4. **Plugin loader.** Proprietary bundle loading via dynamic `import()` based on entitlements; entry point calls `defineGame({ register })` against a stable core API.

## Migration history

- [`docs/superpowers/plans/2026-05-04-group-registry.md`](superpowers/plans/2026-05-04-group-registry.md) — Step 1: Paint → Group registry.
- [`docs/superpowers/plans/2026-05-04-gamemode-registry.md`](superpowers/plans/2026-05-04-gamemode-registry.md) — Step 2: GameMode registry.
