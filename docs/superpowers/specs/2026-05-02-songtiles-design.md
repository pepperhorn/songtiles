# Songtiles — Design

**Status**: Draft (brainstorm complete, pending implementation plan)
**Date**: 2026-05-02

A mobile-first React music app where the user grows a single connected graph of square "domino" tiles on an unbounded canvas. A global playhead walks the graph from a chosen start tile, branching at intersections into parallel playheads, producing evolving polyphony via the smplr engine ported from dottl.

## 1. Core model

- **Canvas** — infinite, pannable, zoomable grid. Tiles snap to integer cells.
- **Graph** — exactly one connected tile graph on the canvas. After the first tile is committed, every new tile must be placed in a cell orthogonally adjacent to the existing graph.
- **Endpoint** — a tile with exactly one neighbor. The user picks an endpoint to be the **start tile**; play begins there.
- **Segment** — a maximal run of tiles between intersections / endpoints. Direction is induced by the chosen start tile (away from start). Segments are the atomic unit of playback mode (sequential vs chord).
- **Intersection** — a tile with 3+ neighbors. The intersection tile itself plays once per its incoming segment's mode, then spawns a new playhead per outgoing segment, all phase-locked to the same beat. Forks → polyphony.
- **Beat clock** — global BPM. Each non-repeat tile consumes 1 beat as the playhead crosses it. Repeat tiles consume 0 beats.

### Tile types

1. **Note tile** — has a fixed pitch (MIDI 36–84, C2..C6) and a face showing note name + dottl color background.
2. **Repeat-Open** — wildcard, no pitch; carries a loop count `1×|2×|3×|4×|∞`.
3. **Repeat-Close** — wildcard, no pitch.

### Deck & tray

- **Deck**: 144 note tiles (12×12). Pitches uniform random over C2..C6. Repeat tiles are a small separate pool always available (TBD count, likely unlimited or 4 of each).
- **Tray**: capacity 4/6/8/9/10/11/12 (user setting). Tiles taken back from a graph endpoint return to the tray. **Discard**: flick a tray tile left or right off the tray edge. **Refill**: button draws random tiles up to capacity.

## 2. Tile semantics

### Per-segment playback mode

Set by tapping the segment's first tile (start tile, or first tile after an intersection):

1. **Sequential** (default) — one tile per beat down the segment.
2. **Solid chord** — all tiles in the segment fire simultaneously when the playhead enters the segment; consumes 1 beat (or `holdBeats`).
3. **Arpeggiated chord** — same notes fired in fast sub-beat succession then sustained as a chord; consumes 1 beat (or `holdBeats`).

Tap cycles: Sequential → Solid → Arp → Sequential.

### Hold (chord modes only)

Double-tap the segment-first tile cycles hold length `1 → 2 → 3 → 4 → 1` beats. The chord sustains for `holdBeats` before the playhead moves on. Visualised as a small badge on the segment-root tile.

### Bass-mode flip (per individual tile)

Long-press a tile to toggle bass mode. While the playhead is in the segment downstream of a bass-flipped tile, that tile's pitch sounds an octave or two lower **alongside** each melody note that plays, sustained until the next bass tile in the segment or until the segment ends. A segment with no bass tiles plays melody only. Bass tiles render visually inverted with a small octave-down arrow.

### Repeat tiles

- Tap a Repeat-Open tile to cycle its count `1× → 2× → 3× → 4× → ∞ → 1×`.
- When a playhead crosses an Open tile, it scans forward along the current path for the matching Close. If found, that section loops the chosen number of times before continuing past Close. If no Close is found on the same path, both Open and Close are silently skipped.
- Repeats may nest (innermost matches first).
- Open and Close consume 0 beats.
- Glyphs use the **Petaluma** music font (SMuFL repeat-start / repeat-end barlines).

## 3. UI & interaction

**Mobile-first**, touch-friendly. Desktop falls out for free.

### Layout

- **Canvas** fills the viewport. One-finger drag pans empty space; pinch zooms. Subtle grid dots; the connected graph centred on first load.
- **Tray** docked at bottom: shows current tiles (4–12 slots). Each tile is draggable. **Flick a tile off the left or right edge of the tray to discard**. Buttons: Refill, Capacity selector.
- **Top bar**: Play / Stop, BPM slider, patch picker (reuses dottl `patchRegistry`), Reset.
- **Detail panel** (slide-up sheet on mobile, side rail on desktop): when a tile is selected, shows segment mode, hold length, bass-flip toggle, repeat count (Repeat-Open only). Mirrors gestures available on the tile itself.

### Tile placement

- Drag a tile from tray onto canvas. Valid drop cells highlight green; invalid dimmed.
- First tile may go anywhere; subsequent tiles must be orthogonally adjacent to the graph.

### Tile retrieval

- Only **endpoint** tiles can be returned. Drag back to tray, or tap and choose Return. Non-endpoint tiles are locked (would split the graph).

### Selecting the start tile

- Endpoints get an outline halo. Tap an endpoint then choose "Set as start", or use a dedicated Start-pick mode where only endpoints are tappable. The start tile gets a ▶ marker.

### Direct gestures on placed tiles

- **Tap** segment-first tile → cycle segment mode. On any other tile → open detail panel.
- **Double-tap** segment-first tile → cycle hold length (chord modes).
- **Long-press** any tile → toggle bass mode.
- **Tap** Repeat-Open → cycle loop count.

### Visual style

- Square tiles ~96px at zoom 1, rounded corners, **simple 3D domino look** (raised drop shadow + subtle edge bevel; nothing skeuomorphic).
- Background = dottl colour for the tile's pitch class. Note name (e.g. "C", "F♯") in bold Poppins, centred. Small octave subscript (e.g. ₃) in a corner.
- Repeat tiles: neutral background with Petaluma repeat-start / repeat-end glyph.
- Bass tiles: inverted/darker treatment + octave-down arrow icon.
- Playhead: soft pulsing ring on the currently sounding tile. Multiple playheads visible after intersections.

## 4. Architecture

### Stack

- React + TypeScript + Vite
- Tailwind + Poppins (per global instructions)
- Zustand for state
- smplr for audio (engine, instruments, sample cache, patch registry — ported from dottl)
- PWA-ready for mobile install
- Vitest for unit tests

### Core types

```ts
type Cell = { x: number; y: number };
type TileId = string;
type Pitch = number; // MIDI 36..84

type TileBase = { id: TileId; cell: Cell };
type NoteTile = TileBase & { kind: 'note'; pitch: Pitch; bass: boolean };
type RepeatOpenTile = TileBase & { kind: 'repeat-open'; count: 1|2|3|4|'inf' };
type RepeatCloseTile = TileBase & { kind: 'repeat-close' };
type Tile = NoteTile | RepeatOpenTile | RepeatCloseTile;

type SegmentMode = 'sequential' | 'solid' | 'arp';
type SegmentSettings = {
  segmentRootId: TileId;            // first tile of segment in play direction
  mode: SegmentMode;
  holdBeats: 1|2|3|4;               // applies to solid/arp only
};

type AppState = {
  tiles: Record<TileId, Tile>;
  byCell: Record<string, TileId>;   // "x,y" -> id, for adjacency lookup
  startTileId: TileId | null;
  segmentSettings: Record<TileId, SegmentSettings>;
  tray: TileId[];
  trayCapacity: 4|6|8|9|10|11|12;
  deck: TileId[];                   // remaining undrawn tiles
  bpm: number;
  patchId: string;
  isPlaying: boolean;
};
```

### Module layout

```
src/
  audio/             # ported from dottl: engine, instruments, sampleCache, patchRegistry
  graph/
    adjacency.ts     # neighbor lookup, endpoint detection
    segments.ts      # walk graph from start; compute segments + intersections
    repeats.ts       # match open/close pairs along a path
  playback/
    scheduler.ts     # walk segment graph and emit per-beat audio events
    playhead.ts      # tracks active playheads (parallel after forks)
  state/
    store.ts         # zustand store
    deck.ts          # initial 144-tile deck, draw/discard/refill
  components/
    Canvas.tsx       # pan/zoom, tile rendering, drop targets, playhead overlay
    Tile.tsx         # 3D domino visual, dottl color, note name, gestures
    Tray.tsx         # bottom tray with flick-to-discard + refill
    TopBar.tsx       # play/stop, bpm, patch
    DetailPanel.tsx  # contextual tile/segment settings
  constants/
    noteColors.ts    # ported dottl color map
    petaluma.ts      # font + glyph mapping for repeat tiles
  App.tsx
  main.tsx
```

### Playback engine

When the user hits Play, the scheduler walks the graph forward in time from the start tile and emits an event list:

1. Start one playhead at `startTileId`, beat = 0.
2. At each step, the current tile fires its audio event(s) per its segment's mode. Advance beat by 1 (sequential), by `holdBeats` (chord modes), or by 0 (repeat tile).
3. **Repeat-Open**: scan the path forward for the matching Close. Emit the looped sub-events `count` times. For `∞`, schedule rolling chunks until Stop. Then continue past Close.
4. **Intersection**: spawn a new playhead per outgoing segment; each continues the walk independently in parallel.
5. **Bass tile**: emit a sustained bass event whose duration is "from now until next bass tile in this segment, or until end of segment".

The event list feeds smplr's sample-accurate scheduling (same pattern as dottl's `sequencer.ts`). Stop = cancel all scheduled events + release sustains.

### Persistence

- LocalStorage snapshot of `AppState`. Auto-save on change.
- Deck state stored deterministically so reload reproduces the same tile contents.

### Testing

- Vitest units for graph adjacency, segment computation, repeat pairing, scheduler event generation.
- Manual QA on real mobile for gestures and audio timing.

## 5. Out of scope (v1)

- Multiple disconnected graphs / multi-canvas projects
- Saving / sharing of compositions to cloud
- MIDI export (tracked in dottl; could be added later)
- Audio recording / export
- Undo/redo history beyond a small in-session ring buffer (TBD whether even that ships in v1)

## 6. Open questions for the implementation plan

- Repeat-tile pool: how many of each available, and are they part of the 144-deck or a separate always-available pool? (Leaning: separate, always available.)
- Bass-mode pitch offset: −1 octave or −2? Or user-settable?
- Capacity changes mid-game: does shrinking capacity force discards? (Leaning: capacity can only grow during a session, or shrinking is blocked while tray > new capacity.)
- Initial start-tile UX: dedicated mode toggle vs. context menu on endpoint tap.
- ∞ repeat scheduling chunk size and look-ahead window.
