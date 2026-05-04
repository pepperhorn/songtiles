# Songtiles

A mobile-first React music app. Grow a single connected graph of square "domino" tiles on an unbounded canvas; a global playhead walks the graph from a chosen start tile, branching at intersections into parallel playheads, producing evolving polyphony via [smplr](https://github.com/danigb/smplr).

Each tile carries a fixed pitch (C2..C6) and a colour from the dottl note-colour palette. Segments between intersections can be played sequentially (one tile per beat), as a solid chord, or arpeggiated. Tiles can be flipped to bass mode, and wildcard Repeat-Open / Repeat-Close tiles loop sections 1×/2×/3×/4×/∞.

Status: design phase. See [`docs/superpowers/specs/2026-05-02-songtiles-design.md`](docs/superpowers/specs/2026-05-02-songtiles-design.md).

## Plugin architecture

The app supports external plugin bundles loaded by URL at boot. Plugins can register new game modes, group types, and tile kinds against a versioned API. See:

- [`docs/PLUGIN_ARCHITECTURE.md`](docs/PLUGIN_ARCHITECTURE.md) — registry surfaces and what's pluggable today
- [`docs/PLUGIN_AUTHORING.md`](docs/PLUGIN_AUTHORING.md) — how to write a plugin (worked example)
- [`docs/PLUGIN_API_CHANGELOG.md`](docs/PLUGIN_API_CHANGELOG.md) — API version history

Try the demo: `npm run build:demo-plugin && npm run dev`, then visit `/?plugin=/plugins/demo.js`.

## License

MIT — see [`LICENSE`](LICENSE). The MIT license imposes no restrictions on plugins: external plugin bundles (loaded via the runtime ESM import path) are not derivative works of the core, and even where derivation could be argued, MIT permits commercial sale and proprietary distribution of derivatives. Plugin authors are free to ship paid, closed-source, or otherwise proprietary plugins under any license they choose.
