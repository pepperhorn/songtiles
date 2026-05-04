# Group Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalize hardcoded `Paint { kind: 'chord' | 'arp' }` into a `Group` registry where each group type (`chord`, `arp`, future `loop` / `random-pick` / `dice`) is a registered module with its own audio behavior, color, and toolbar entry. Behavior is preserved 1:1 — this is a refactor that creates the seam plugins will eventually use.

**Architecture:** Introduce `src/groups/` module with a `GroupType` interface and a registry. Existing `Paint` becomes `Group` (a thin data record `{ id, typeId, tileIds }`). Built-in `chord` and `arp` group types live in `src/groups/builtin/`. The playhead loops over registered group types instead of switching on `kind`. Toolbar enumerates the registry. No plugin loader yet — the registry is populated at module init by core. Existing tests must continue to pass unchanged in behavior.

**Tech Stack:** TypeScript, Zustand, Vite, Vitest, React.

**Out of scope:** Plugin loader, tile-kind registry (repeats stay hardcoded), interactive prompt channel, gameMode registry. Each is a future plan.

---

## File Structure

**Create:**
- `src/groups/types.ts` — `GroupType` interface, `Group` data record, `GroupTypeId`
- `src/groups/registry.ts` — `registerGroupType`, `getGroupType`, `listGroupTypes`
- `src/groups/builtin/chord.ts` — chord group type
- `src/groups/builtin/arp.ts` — arp group type
- `src/groups/builtin/index.ts` — registers built-ins on import
- `src/groups/index.ts` — public barrel
- `tests/groups/registry.test.ts` — registry behavior
- `tests/groups/builtin.test.ts` — chord/arp emit shapes match prior behavior

**Modify:**
- `src/graph/types.ts` — replace `Paint`/`PaintKind`/`PaintId` with `Group`/`GroupTypeId`/`GroupId`. Keep `PaintTool` (UI concept distinct from group type — still includes `bass`, `eraser`).
- `src/playback/playhead.ts` — replace `kind === 'chord' / 'arp'` switch with `groupType.onFire(...)`. Rename `paints` param → `groups`.
- `src/playback/scheduler.ts` — rename `paints` → `groups` on `SchedulerSnapshot`.
- `src/state/store.ts` — rename `paints` field → `groups`; `commitInProgressPaint` writes `Group` records with `typeId`.
- `src/state/persistence.ts` — migrate serialised key `paints` → `groups` (with read-side back-compat for one release).
- `src/components/PaintToolbar.tsx` — derive chord/arp buttons from registry; bass/eraser stay hardcoded (they're not group types).
- `src/components/Tile.tsx`, `src/components/Canvas.tsx`, `src/components/DetailPanel.tsx`, `src/App.tsx` — rename references.
- `tests/playback/playhead.test.ts`, `tests/playback/scheduler.test.ts`, `tests/state/persistence.test.ts` — update fixtures to use `groups`.
- `src/main.tsx` — `import './groups/builtin'` so registrations run before first render.

**Naming decision:** "Paint" was both a noun (the data) and a verb (the painting UX). Keeping `paintTool`, `paintingTileIds`, "paint mode" for the UX (it stays a painting interaction). Renaming only the data shape: `paints` → `groups`. This is the smaller blast radius.

---

## Task 1: Define GroupType interface and registry

**Files:**
- Create: `src/groups/types.ts`
- Create: `src/groups/registry.ts`
- Test: `tests/groups/registry.test.ts`

- [ ] **Step 1: Write `src/groups/types.ts`**

```ts
import type { Tile, TileId } from '../graph/types';
import type { ScheduledNote } from '../playback/events';

export type GroupTypeId = string;
export type GroupId = string;

/** Persisted group instance — references a registered GroupType by id. */
export interface Group {
  id: GroupId;
  typeId: GroupTypeId;
  tileIds: TileId[];
}

/** Context passed to GroupType.onFire when the playhead first hits a tile in the group. */
export interface GroupFireContext {
  group: Group;
  tiles: Record<TileId, Tile>;
  /** Audio-context time the playhead reached the triggering tile. */
  when: number;
  /** Seconds per beat at the current bpm. */
  beatSec: number;
  emit: (note: ScheduledNote) => void;
}

/** A registered group type. Defines visual, toolbar, and audio behavior for a Group. */
export interface GroupType {
  id: GroupTypeId;
  /** Toolbar label, e.g. "Chord". */
  label: string;
  /** Toolbar icon glyph. */
  icon: string;
  /** Highlight tint for tiles in groups of this type. */
  color: string;
  /** Called once per pass when the playhead first hits any tile in the group.
   *  Implementations emit ScheduledNotes via ctx.emit. */
  onFire(ctx: GroupFireContext): void;
}
```

- [ ] **Step 2: Write `src/groups/registry.ts`**

```ts
import type { GroupType, GroupTypeId } from './types';

const registry = new Map<GroupTypeId, GroupType>();

export function registerGroupType(type: GroupType): void {
  if (registry.has(type.id)) {
    throw new Error(`GroupType "${type.id}" already registered`);
  }
  registry.set(type.id, type);
}

export function getGroupType(id: GroupTypeId): GroupType | undefined {
  return registry.get(id);
}

export function listGroupTypes(): GroupType[] {
  return Array.from(registry.values());
}

/** Test-only: drop all registrations. */
export function _resetRegistryForTests(): void {
  registry.clear();
}
```

- [ ] **Step 3: Write `tests/groups/registry.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerGroupType, getGroupType, listGroupTypes, _resetRegistryForTests,
} from '../../src/groups/registry';
import type { GroupType } from '../../src/groups/types';

const dummy: GroupType = {
  id: 'dummy', label: 'Dummy', icon: '?', color: '#000',
  onFire: () => {},
};

describe('group registry', () => {
  beforeEach(() => _resetRegistryForTests());

  it('registers and retrieves a group type', () => {
    registerGroupType(dummy);
    expect(getGroupType('dummy')).toBe(dummy);
  });

  it('lists registered types in registration order', () => {
    const a = { ...dummy, id: 'a' };
    const b = { ...dummy, id: 'b' };
    registerGroupType(a);
    registerGroupType(b);
    expect(listGroupTypes().map(t => t.id)).toEqual(['a', 'b']);
  });

  it('throws when registering a duplicate id', () => {
    registerGroupType(dummy);
    expect(() => registerGroupType(dummy)).toThrow(/already registered/);
  });

  it('returns undefined for unknown ids', () => {
    expect(getGroupType('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/groups/registry.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/groups/types.ts src/groups/registry.ts tests/groups/registry.test.ts
git commit -m "feat(groups): GroupType interface and registry"
```

---

## Task 2: Built-in chord and arp group types

**Files:**
- Create: `src/groups/builtin/chord.ts`
- Create: `src/groups/builtin/arp.ts`
- Create: `src/groups/builtin/index.ts`
- Create: `src/groups/index.ts`
- Test: `tests/groups/builtin.test.ts`

Behavior must match `src/playback/playhead.ts:138-160` exactly:
- **chord:** all note tiles fire at `when`, duration = `N * beatSec`.
- **arp:** `2N` pulses spaced at `beatSec / 2`, cycling through note tiles twice.

- [ ] **Step 1: Write `src/groups/builtin/chord.ts`**

```ts
import type { GroupType } from '../types';
import type { NoteTile, Tile } from '../../graph/types';

export const CHORD_GROUP: GroupType = {
  id: 'chord',
  label: 'Chord',
  icon: '♬',
  color: '#3b82f6',
  onFire({ group, tiles, when, beatSec, emit }) {
    const notes = group.tileIds
      .map(id => tiles[id])
      .filter((t): t is NoteTile => t?.kind === 'note');
    if (notes.length === 0) return;
    const dur = notes.length * beatSec;
    for (const nt of notes) {
      emit({ midi: nt.pitch, when, duration: dur, velocity: 0.8, tileId: nt.id });
    }
  },
};
```

- [ ] **Step 2: Write `src/groups/builtin/arp.ts`**

```ts
import type { GroupType } from '../types';
import type { NoteTile } from '../../graph/types';

export const ARP_GROUP: GroupType = {
  id: 'arp',
  label: 'Arp',
  icon: '∿',
  color: '#a855f7',
  onFire({ group, tiles, when, beatSec, emit }) {
    const notes = group.tileIds
      .map(id => tiles[id])
      .filter((t): t is NoteTile => t?.kind === 'note');
    const N = notes.length;
    if (N === 0) return;
    const pulseSec = beatSec / 2;
    const totalPulses = 2 * N;
    for (let k = 0; k < totalPulses; k++) {
      const nt = notes[k % N];
      emit({
        midi: nt.pitch,
        when: when + k * pulseSec,
        duration: pulseSec,
        velocity: 0.8,
        tileId: nt.id,
      });
    }
  },
};
```

- [ ] **Step 3: Write `src/groups/builtin/index.ts`**

```ts
import { registerGroupType } from '../registry';
import { CHORD_GROUP } from './chord';
import { ARP_GROUP } from './arp';

registerGroupType(CHORD_GROUP);
registerGroupType(ARP_GROUP);
```

- [ ] **Step 4: Write `src/groups/index.ts`**

```ts
export type { GroupType, Group, GroupId, GroupTypeId, GroupFireContext } from './types';
export { registerGroupType, getGroupType, listGroupTypes } from './registry';
export { CHORD_GROUP } from './builtin/chord';
export { ARP_GROUP } from './builtin/arp';
```

- [ ] **Step 5: Write `tests/groups/builtin.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { CHORD_GROUP } from '../../src/groups/builtin/chord';
import { ARP_GROUP } from '../../src/groups/builtin/arp';
import type { Group } from '../../src/groups/types';
import type { Tile } from '../../src/graph/types';
import type { ScheduledNote } from '../../src/playback/events';

const tiles: Record<string, Tile> = {
  a: { id: 'a', kind: 'note', pitch: 60, bass: false, cell: { x: 0, y: 0 } },
  b: { id: 'b', kind: 'note', pitch: 64, bass: false, cell: { x: 1, y: 0 } },
  c: { id: 'c', kind: 'note', pitch: 67, bass: false, cell: { x: 2, y: 0 } },
};

describe('chord group', () => {
  it('emits all notes at the same time with duration = N * beatSec', () => {
    const out: ScheduledNote[] = [];
    const group: Group = { id: 'g', typeId: 'chord', tileIds: ['a', 'b', 'c'] };
    CHORD_GROUP.onFire({ group, tiles, when: 1.0, beatSec: 0.5, emit: n => out.push(n) });
    expect(out).toHaveLength(3);
    expect(out.every(n => n.when === 1.0)).toBe(true);
    expect(out.every(n => n.duration === 1.5)).toBe(true);
    expect(out.map(n => n.midi).sort()).toEqual([60, 64, 67]);
  });
});

describe('arp group', () => {
  it('emits 2N pulses at beatSec/2 spacing, cycling tiles twice', () => {
    const out: ScheduledNote[] = [];
    const group: Group = { id: 'g', typeId: 'arp', tileIds: ['a', 'b', 'c'] };
    ARP_GROUP.onFire({ group, tiles, when: 0, beatSec: 0.5, emit: n => out.push(n) });
    expect(out).toHaveLength(6);
    expect(out.map(n => n.midi)).toEqual([60, 64, 67, 60, 64, 67]);
    expect(out.map(n => n.when)).toEqual([0, 0.25, 0.5, 0.75, 1.0, 1.25]);
    expect(out.every(n => n.duration === 0.25)).toBe(true);
  });

  it('skips non-note tiles', () => {
    const out: ScheduledNote[] = [];
    const tilesWithRepeat: Record<string, Tile> = {
      ...tiles,
      r: { id: 'r', kind: 'repeat', count: 2, cell: null },
    };
    const group: Group = { id: 'g', typeId: 'arp', tileIds: ['a', 'r', 'b'] };
    ARP_GROUP.onFire({ group, tiles: tilesWithRepeat, when: 0, beatSec: 1, emit: n => out.push(n) });
    expect(out.map(n => n.midi)).toEqual([60, 64, 60, 64]);
  });
});
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/groups/`
Expected: all passed.

- [ ] **Step 7: Commit**

```bash
git add src/groups tests/groups/builtin.test.ts
git commit -m "feat(groups): chord and arp built-in group types"
```

---

## Task 3: Replace `Paint` with `Group` in graph types

**Files:**
- Modify: `src/graph/types.ts`

This is the rename. Downstream files break until subsequent tasks update them — that's expected; we fix in order.

- [ ] **Step 1: Update `src/graph/types.ts`**

Replace lines 41-48 (`PaintId`, `PaintKind`, `Paint`, `PaintTool`):

```ts
// Re-exported from src/groups for convenience.
export type { Group, GroupId, GroupTypeId } from '../groups/types';
/** Toolbar tools — superset of group types plus non-group tools (bass, eraser). */
export type PaintTool = 'chord' | 'arp' | 'bass' | 'eraser' | null;
```

- [ ] **Step 2: Verify nothing in `graph/` else references `Paint`**

Run: `grep -n "Paint\|PaintId\|PaintKind" src/graph/`
Expected: only the `PaintTool` line above; no `Paint` (without `Tool`) references.

- [ ] **Step 3: Commit (will not yet typecheck — that's fine, dependent tasks follow)**

```bash
git add src/graph/types.ts
git commit -m "refactor(types): replace Paint with Group, re-exported from groups module"
```

---

## Task 4: Migrate playhead to use the registry

**Files:**
- Modify: `src/playback/playhead.ts`
- Modify: `tests/playback/playhead.test.ts`

- [ ] **Step 1: Update `src/playback/playhead.ts`**

Replace top-of-file imports and `Args`:

```ts
import type { Segment } from '../graph/segments';
import type { Tile, TileId } from '../graph/types';
import type { Group, GroupId } from '../groups/types';
import { getGroupType } from '../groups/registry';
import type { ScheduleEmit } from './events';

interface Args {
  segments: Segment[];
  tiles: Record<TileId, Tile>;
  groups: Record<GroupId, Group>;
  startTime: number;
  beatSec: number;
  windowEnd: number;
  emit: ScheduleEmit;
}
```

Update signature: `export function advancePlayhead({ segments, tiles, groups, startTime, beatSec, windowEnd, emit }: Args) {`

Replace the index block (was lines 35-43):

```ts
  // Index: tileId → list of groups that contain it.
  const groupsByTile = new Map<TileId, Group[]>();
  for (const g of Object.values(groups)) {
    for (const t of g.tileIds) {
      const list = groupsByTile.get(t) ?? [];
      list.push(g);
      groupsByTile.set(t, list);
    }
  }

  const firedGroups = new Set<GroupId>();
  const consumedTiles = new Set<TileId>();
```

Replace the per-tile firing block inside `fireIndex` (was lines 111-161). Find:
```ts
      const tilePaints = paintsByTile.get(item.id) ?? [];
      const unfired = tilePaints.filter(p => !firedPaints.has(p.id));
```
and the whole emit-per-paint loop, and replace with:

```ts
      const tileGroups = groupsByTile.get(item.id) ?? [];
      const unfired = tileGroups.filter(g => !firedGroups.has(g.id));

      if (unfired.length === 0) {
        emit({ midi: t.pitch, when, duration: beatSec, velocity: 0.8, tileId: item.id });
        if (t.bass) {
          closeBass(beat + beatOffset);
          const pc = ((t.pitch % 12) + 12) % 12;
          activeBass = { midi: 36 + pc, startBeat: beat + beatOffset };
        }
        return { beats: 1, aborted: false };
      }

      for (const g of unfired) {
        firedGroups.add(g.id);
        for (const tid of g.tileIds) consumedTiles.add(tid);
      }

      for (const g of unfired) {
        const type = getGroupType(g.typeId);
        if (!type) continue; // unknown group type — silently skip
        type.onFire({ group: g, tiles, when, beatSec, emit });
      }

      return { beats: 1, aborted: false };
```

Update the file's docblock at lines 19-31 to refer to "groups" instead of "paints", and remove the chord/arp specifics (they live in their group types now).

- [ ] **Step 2: Update `tests/playback/playhead.test.ts`**

Run: `grep -n "paints\|Paint" tests/playback/playhead.test.ts`

For each match, rename:
- `paints:` → `groups:`
- `Paint` import → `Group` from `src/groups/types`
- `kind: 'chord'` → `typeId: 'chord'`
- `kind: 'arp'` → `typeId: 'arp'`

At the top of the test file, ensure built-ins are registered:
```ts
import '../../src/groups/builtin';
```

- [ ] **Step 3: Run playhead tests**

Run: `npx vitest run tests/playback/playhead.test.ts`
Expected: all previously-passing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/playback/playhead.ts tests/playback/playhead.test.ts
git commit -m "refactor(playhead): dispatch via group registry instead of kind switch"
```

---

## Task 5: Migrate scheduler

**Files:**
- Modify: `src/playback/scheduler.ts`
- Modify: `tests/playback/scheduler.test.ts`

- [ ] **Step 1: Update `src/playback/scheduler.ts`**

Replace the import line:
```ts
import type { Tile, TileId } from '../graph/types';
import type { Group, GroupId } from '../groups/types';
```

In `SchedulerSnapshot`:
```ts
export interface SchedulerSnapshot {
  segments: Segment[];
  tiles: Record<TileId, Tile>;
  groups: Record<GroupId, Group>;
  bpm: number;
}
```

Update the `advancePlayhead` call: `paints: snapshot.paints` → `groups: snapshot.groups`.

- [ ] **Step 2: Update `tests/playback/scheduler.test.ts`**

Same rename pattern: `paints` → `groups`, add `import '../../src/groups/builtin'`.

- [ ] **Step 3: Run scheduler tests**

Run: `npx vitest run tests/playback/scheduler.test.ts`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/playback/scheduler.ts tests/playback/scheduler.test.ts
git commit -m "refactor(scheduler): rename paints → groups in snapshot"
```

---

## Task 6: Migrate the store

**Files:**
- Modify: `src/state/store.ts`

The store is the biggest single change. Map of replacements (mechanical):

| Before | After |
|---|---|
| `Paint, PaintId, PaintKind` (in import from `graph/types`) | `Group, GroupId, GroupTypeId` (from `../groups/types`) |
| `paints: Record<PaintId, Paint>` (state field, typing, init) | `groups: Record<GroupId, Group>` |
| `nextPaints` local var | `nextGroups` |
| `commitInProgressPaint(set, get, kind)` signature `kind: PaintKind` | `typeId: GroupTypeId` |
| `const paint: Paint = { id, kind, tileIds: ids }` | `const group: Group = { id, typeId, tileIds: ids }` |
| `set({ paints: { ...s.paints, [id]: paint } })` | `set({ groups: { ...s.groups, [id]: group } })` |
| Snapshot for scheduler `paints: st.paints` (around line 380) | `groups: st.groups` |

`paintTool`, `paintingTileIds`, `setPaintTool`, `togglePaintMembership`, `commitPaint`, `removeTileFromAllPaints` keep their names — they're UX-layer concepts.

Inside `setPaintTool` and `togglePaintMembership`, the `s.paintTool === 'chord' || s.paintTool === 'arp'` checks remain for now (Task 9 will lift these to a registry-driven check).

- [ ] **Step 1: Apply the renames per the table above**

Use Edit; verify with: `grep -n "paints\|Paint[^Tt]" src/state/store.ts`
Expected: no matches except `paintTool`, `paintingTileIds`, `setPaintTool`, `togglePaintMembership`, `commitPaint`, `commitInProgressPaint`, `removeTileFromAllPaints`, `PaintTool` (the type).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only in unmigrated downstream files (App.tsx, components, persistence). No errors in store.ts itself.

- [ ] **Step 3: Commit**

```bash
git add src/state/store.ts
git commit -m "refactor(store): rename paints → groups; commit writes typeId-keyed Group"
```

---

## Task 7: Migrate persistence (with read back-compat)

**Files:**
- Modify: `src/state/persistence.ts`
- Modify: `tests/state/persistence.test.ts`

Read existing autosaves that still have `paints` and a `kind` field; write the new shape going forward.

- [ ] **Step 1: Read `src/state/persistence.ts`** to identify the field names used in `serialise` and `deserialise`.

- [ ] **Step 2: Write side — emit `groups` array of `{ id, typeId, tileIds }`**

- [ ] **Step 3: Read side — accept either `groups` (new) or `paints` (legacy):**

```ts
const rawGroups = parsed.groups ?? parsed.paints ?? [];
const groups: Record<GroupId, Group> = {};
for (const g of rawGroups) {
  const typeId = g.typeId ?? g.kind;  // legacy used `kind`
  if (!typeId) continue;
  groups[g.id] = { id: g.id, typeId, tileIds: g.tileIds };
}
```

- [ ] **Step 4: Update `tests/state/persistence.test.ts`** to use the new shape, and add one test that decodes a legacy `paints`/`kind` blob and produces equivalent `groups`.

- [ ] **Step 5: Run persistence tests**

Run: `npx vitest run tests/state/persistence.test.ts`
Expected: pass, including the legacy-decode test.

- [ ] **Step 6: Commit**

```bash
git add src/state/persistence.ts tests/state/persistence.test.ts
git commit -m "refactor(persistence): serialise as groups; decode legacy paints field"
```

---

## Task 8: Register built-ins on app boot

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: Read `src/main.tsx`** and add `import './groups/builtin';` after React imports, before `App`.

- [ ] **Step 2: Commit**

```bash
git add src/main.tsx
git commit -m "feat(groups): register built-ins on app boot"
```

---

## Task 9: Migrate UI components

**Files:**
- Modify: `src/components/PaintToolbar.tsx`
- Modify: `src/components/Tile.tsx`
- Modify: `src/components/Canvas.tsx`
- Modify: `src/components/DetailPanel.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: `PaintToolbar.tsx` — derive chord/arp buttons from registry**

Replace the hardcoded `TOOLS` array. Pseudocode:

```tsx
import { listGroupTypes } from '../groups/registry';

const groupTypes = listGroupTypes();
const TOOLS: Array<{ tool: Exclude<PaintTool, null>; label: string; icon: string; color: string }> = [
  ...groupTypes.map(gt => ({ tool: gt.id as Exclude<PaintTool, null>, label: gt.label, icon: gt.icon, color: gt.color })),
  { tool: 'bass', label: 'Bass', icon: '↓', color: '#0ea5e9' },
  { tool: 'eraser', label: 'Erase', icon: '⌫', color: '#ef4444' },
];
```

Drop the hardcoded `TOOL_COLOR` map; read `color` from each tool entry.

Note: `PaintTool` is currently a fixed union `'chord' | 'arp' | 'bass' | 'eraser' | null`. For now, accept the cast — broadening `PaintTool` to `string` is a Task 4-of-the-larger-migration concern. Add a brief type assertion:

```tsx
tool: gt.id as Exclude<PaintTool, null>,
```

- [ ] **Step 2: `Tile.tsx`, `Canvas.tsx`, `DetailPanel.tsx`, `App.tsx` — rename `paints` → `groups` for store reads**

For each file:
```bash
grep -n "s.paints\|paints\[" src/components/*.tsx src/App.tsx
```
Replace with `s.groups` / `groups[`.

For places that read `paint.kind`, replace with `group.typeId`. For places that need the color, look up via `getGroupType(group.typeId)?.color`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 5: Visual smoke test in dev server**

Run: `npm run dev -- --host 0.0.0.0`

In a browser:
- Create a chord paint (2+ tiles), press play, confirm chord sounds.
- Create an arp paint, press play, confirm arp sounds (2N pulses).
- Confirm tiles still get group-color drop shadow.
- Reload the page; confirm autosave restored both groups.

- [ ] **Step 6: Commit**

```bash
git add src/components src/App.tsx
git commit -m "refactor(ui): derive paint toolbar from group registry; rename paints → groups"
```

---

## Task 10: Final sweep

- [ ] **Step 1: Search for stragglers**

Run: `grep -rn "PaintKind\|PaintId\b" src tests`
Expected: zero matches.

Run: `grep -rn "paints\b" src tests`
Expected: zero matches in source files; matches only in `persistence.ts` legacy-read code path and its test.

- [ ] **Step 2: Run full suite + typecheck**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean + all green.

- [ ] **Step 3: Commit any cleanup**

```bash
git add -u
git commit -m "chore(groups): final sweep — remove residual Paint references" --allow-empty
```

---

## Self-Review Notes

- **Spec coverage:** every claim in the user-facing migration map for "Step 1" is addressed (Group registry, chord/arp as built-ins, color via registry, toolbar derived from registry, playhead via registry).
- **Out-of-scope clearly listed:** plugin loader, tile-kind registry, prompt channel, gameMode registry — each gets its own future plan.
- **Type consistency:** `Group { id, typeId, tileIds }`, `GroupType { id, label, icon, color, onFire }`, `GroupFireContext { group, tiles, when, beatSec, emit }`. Used identically across tasks.
- **No placeholders:** every code-changing step shows the code or the exact rename rule.
- **One known soft spot:** Task 9 keeps `PaintTool` as a fixed union. That's deliberate — broadening it requires touching every paint-tool consumer, and group types beyond chord/arp don't exist yet in this plan. Cleanup falls naturally out of the next plan (tile-kind registry / plugin loader).
