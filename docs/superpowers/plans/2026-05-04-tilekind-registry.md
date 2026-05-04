# TileKind Registry Implementation Plan

**Goal:** Generalize hardcoded `Tile = NoteTile | RepeatTile` into a TileKind registry that owns each kind's content rendering, tap behavior, and deck wildcard insertion. Built-in `note` and `repeat` preserve current behavior 1:1.

**Architecture:** New `src/tiles/` module mirroring `src/groups/` and `src/games/`. A `TileKind` carries `{ id, label, renderContent(props), onTap?(id, store), deckWildcardCount?(noteCount, wildness) }`. The Tile component keeps its outer chrome (size, shadows, halo) and delegates inner content to the registry. The deck builder iterates registered kinds with `deckWildcardCount` to insert wildcards.

**Out of scope:**
- Opening up the `Tile` discriminated union to arbitrary string kinds (Tile.tsx and playhead.ts still narrow on `note` | `repeat` for typesafety).
- Flow-control extension (repeat block-loop stays hardcoded in playhead).

This plan establishes the contract and migrates built-in renders/taps/wildcards into the registry. Full openness of the `Tile` type is a future plan.

## Files

- Create: `src/tiles/types.ts`, `src/tiles/registry.ts`
- Create: `src/tiles/builtin/note.tsx`, `src/tiles/builtin/repeat.tsx`, `src/tiles/builtin/index.ts`
- Create: `src/tiles/index.ts`
- Create: `tests/tiles/registry.test.ts`
- Modify: `src/components/Tile.tsx` — delegate inner content
- Modify: `src/games/builtin/deckHelpers.ts` — registry-driven wildcard loop
- Modify: `src/components/Canvas.tsx` — tap dispatch via registry
- Modify: `src/main.tsx` — `import './tiles/builtin'`
- Modify: `docs/PLUGIN_ARCHITECTURE.md`
