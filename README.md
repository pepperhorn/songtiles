# Songtiles

A mobile-first React music app. Grow a single connected graph of square "domino" tiles on an unbounded canvas; a global playhead walks the graph from a chosen start tile, branching at intersections into parallel playheads, producing evolving polyphony via [smplr](https://github.com/danigb/smplr).

Each tile carries a fixed pitch (C2..C6) and a colour from the dottl note-colour palette. Segments between intersections can be played sequentially (one tile per beat), as a solid chord, or arpeggiated. Tiles can be flipped to bass mode, and wildcard Repeat-Open / Repeat-Close tiles loop sections 1×/2×/3×/4×/∞.

Status: design phase. See [`docs/superpowers/specs/2026-05-02-songtiles-design.md`](docs/superpowers/specs/2026-05-02-songtiles-design.md).

## Plugin architecture

The app is being refactored toward a pluggable framework so proprietary game modes and content can extend the OSS core without forking it. See [`docs/PLUGIN_ARCHITECTURE.md`](docs/PLUGIN_ARCHITECTURE.md) for what's pluggable today (group types, game modes), what's still hardcoded, and the registry interfaces.
