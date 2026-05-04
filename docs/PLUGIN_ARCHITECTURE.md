# Plugin Architecture

Doremino is being refactored to support pluggable game modules. This document tracks what's pluggable today, what's not yet, and the contract each registry exposes.

## Status

| Surface | State | Registry | Built-ins |
|---|---|---|---|
| **Group types** (chord, arp, future loop / random-pick / dice) | ✅ Pluggable | `src/groups/registry.ts` | `chord`, `arp` |
| **Game modes** (deck builder + setup UI fragment) | ✅ Pluggable | `src/games/registry.ts` | `explorer`, `scale` |
| **Tile kinds** (visual + tap + deck wildcards) | ✅ Pluggable (visual layer) | `src/tiles/registry.ts` | `note`, `repeat` |
| **Playback flow control** (repeat block-loop, future jumps / branches) | ❌ Hardcoded in playhead | — | `repeat` only |
| **Interactive prompts** (sing-the-pitch, dice roll) | ❌ Not implemented | — | — |
| **Plugin loader** (load ESM bundle by URL at boot) | ✅ Live | `src/plugin/loader.ts` | `?plugin=URL` query string |

External plugins are loaded at boot via `?plugin=URL` query-string params. Each plugin is an ESM bundle whose default export is a `PluginManifest` with an `apiVersion` field; the loader validates the manifest, enforces version compatibility, then calls `manifest.register(api)`. See [`PLUGIN_AUTHORING.md`](PLUGIN_AUTHORING.md) for how to write a plugin and [`PLUGIN_API_CHANGELOG.md`](PLUGIN_API_CHANGELOG.md) for the API version history.

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

## Tile-kind registry

Each tile kind owns its visual content, tap behavior, and optional deck wildcards.

```ts
interface TileKind {
  id: TileKindId;
  label: string;
  containerStyle?(props): CSSProperties;        // background color, etc
  containerClassName?: string;                  // extra DOM class
  renderContent(props: RenderContentProps): ReactNode;  // inner content
  onTap?(id, store): void;                      // double-tap action
  deckWildcards?(opts): void;                   // contribute wildcards at deck-build time
}
```

`Tile.tsx` keeps the shared chrome (size, border, shadow, halo, opacity); each kind contributes the inner content + container style. `createDeck` walks every registered kind that has `deckWildcards` and asks it to push tiles. Canvas's double-tap handler dispatches to `kind.onTap`.

Register: `registerTileKind(MY_KIND)`.

**Pluggable today:**
- Visual rendering of any kind (plugins can add new tile faces).
- Deck wildcard injection (a plugin tile kind can show up alongside repeat as a wildcard).
- Tap behavior on any registered kind.

**Not yet pluggable:**
- The `Tile` TypeScript discriminated union is still closed (`NoteTile | RepeatTile`). Plugin tiles need to ride on top of one of the existing kinds for typesafety, or the union needs to be opened in a future plan.
- Playback behavior — the playhead still narrows on `'note' | 'repeat'`. Plugin tile kinds without flow-control implications can still appear in the deck, but they won't influence playback yet.

## What's still hardcoded

1. **Tile type union.** Opening `Tile` to arbitrary `kind: string` requires touching every narrowing site (playhead, canvas adjacency, repeats utility). Future plan.
2. **Flow-control playback.** The playhead has dedicated logic for repeat tiles (block-folding the path into looping sections + tail). Generalizing this to plugin-defined flow control requires an interface where a tile kind exposes a `walk(path, state)` reducer.
3. **Interactive prompts.** `prompt(payload) -> Promise<result>` channel through the scheduler so games like "sing the pitch" or "roll the dice" can pause playback, surface UI, and resume.
4. **Entitlement / signature verification.** The loader fetches and runs any plugin URL it's given. Paywall, license validation, and code-signing belong on top of this surface in a future plan.

## Migration history

- [`docs/superpowers/plans/2026-05-04-group-registry.md`](superpowers/plans/2026-05-04-group-registry.md) — Step 1: Paint → Group registry.
- [`docs/superpowers/plans/2026-05-04-gamemode-registry.md`](superpowers/plans/2026-05-04-gamemode-registry.md) — Step 2: GameMode registry.
- [`docs/superpowers/plans/2026-05-04-tilekind-registry.md`](superpowers/plans/2026-05-04-tilekind-registry.md) — Step 3: TileKind registry (visual layer).
- [`docs/superpowers/plans/2026-05-04-plugin-loader.md`](superpowers/plans/2026-05-04-plugin-loader.md) — Step 4: URL-based plugin loader + versioned API.
