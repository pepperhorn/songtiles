# Plugin Loader Implementation Plan

**Goal:** Ship the actual loader that makes the framework "real" — proprietary plugin bundles can be loaded from URLs at runtime, register against the existing GroupType / GameMode / TileKind registries, and pass an API-version compatibility check.

**Architecture:** Plugin authors write a `PluginManifest` with an `apiVersion` field declaring which version of the core API they target. The core ships a stable `PluginAPI` (re-exporting `registerGroupType`, `registerGameMode`, `registerTileKind`). The loader dynamic-imports an ESM URL, validates the manifest, checks version compatibility, then calls `manifest.register(api)`.

**Versioning:** the API has its own integer `CURRENT_API_VERSION` (starting at 1) plus a `MIN_SUPPORTED_API_VERSION`. Breaking changes bump the major; non-breaking additions stay compatible. Every change is documented in `docs/PLUGIN_API_CHANGELOG.md`.

**Out of scope:**
- Entitlement / license / signature verification (paywall mechanics — future plan).
- Plugin SDK helpers (e.g. exposing `buildDeckFromPitchClasses` to plugins) — plugins build everything inline for v1.
- Plugin uninstall / hot-reload.

## Files

- Create: `src/plugin/types.ts` — `PluginManifest`, `PluginAPI`
- Create: `src/plugin/api.ts` — `definePlugin`, `getPluginAPI`, version constants
- Create: `src/plugin/loader.ts` — `loadPlugin(url)`, `loadPluginsFromQuery()`
- Create: `tests/plugin/loader.test.ts`
- Create: `examples/demo-plugin/index.ts` + `examples/demo-plugin/build.mjs`
- Create: `docs/PLUGIN_API_CHANGELOG.md`
- Create: `docs/PLUGIN_AUTHORING.md`
- Modify: `src/main.tsx` — async bootstrap awaits plugin load before render
- Modify: `package.json` — `build:demo-plugin` script
- Modify: `docs/PLUGIN_ARCHITECTURE.md`
