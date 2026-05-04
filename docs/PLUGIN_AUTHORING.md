# Authoring a Doremino Plugin

A plugin is an ESM bundle whose default export is a `PluginManifest`. The host app loads the bundle from a URL at boot, checks API compatibility, and calls `manifest.register(api)`. The plugin uses `api` to register its contributions to the core registries.

For the API surface and version policy, see [`PLUGIN_API_CHANGELOG.md`](PLUGIN_API_CHANGELOG.md).

## Anatomy of a plugin

```ts
import type { PluginManifest, PluginAPI } from '@doremino/core/plugin';
import type { GameMode } from '@doremino/core/games';

const MY_MODE: GameMode<{}> = {
  id: 'com.acme.bluesgame',
  label: 'Blues',
  blurb: 'Twelve-bar blues scale.',
  defaultParams: {},
  buildDeck({ wildness, rng }) { /* ... */ },
};

const manifest: PluginManifest = {
  apiVersion: 1,
  id: 'com.acme.bluesgame',
  name: 'Blues Game',
  version: '0.1.0',
  register(api: PluginAPI) {
    api.registerGameMode(MY_MODE);
  },
};

export default manifest;
```

**Important:** import only **types** from `@doremino/core/*`. Runtime symbols come exclusively through the `register(api)` callback. This is what lets your bundle externalize the core entirely — or, equivalently, depend on no runtime symbols at all if you build everything inline.

## Building the bundle

Use any modern bundler that emits ESM. The reference setup uses `esbuild`:

```js
// build.mjs
import { build } from 'esbuild';

await build({
  entryPoints: ['./index.ts'],
  outfile: './dist/plugin.js',
  bundle: true,
  format: 'esm',
  target: 'es2020',
  platform: 'browser',
  sourcemap: true,
});
```

A worked example lives in [`examples/demo-plugin/`](../examples/demo-plugin) — a "C-major pentatonic" game mode plugin. Build it with `npm run build:demo-plugin`; the output lands at `public/plugins/demo.js` and can be loaded by visiting the app at `/?plugin=/plugins/demo.js`.

## Loading a plugin

The host loads any `?plugin=URL` query-string entries at boot:

```
https://doremino.app/?plugin=https://cdn.example.com/blues.js
```

Multiple plugins are loaded in order; one bad bundle won't block the others.

For programmatic loading from your own UI, import `loadPlugin` from `src/plugin/loader.ts` and call it with a URL.

## Versioning

Set `apiVersion` on your manifest to the major version of the core API your plugin was built against. Today that's **1**. The host:

- **Rejects** plugins targeting an `apiVersion` higher than the host supports ("update the app").
- **Rejects** plugins targeting an `apiVersion` below `MIN_SUPPORTED_API_VERSION` ("update the plugin").

Track API changes in [`PLUGIN_API_CHANGELOG.md`](PLUGIN_API_CHANGELOG.md). Non-breaking additions (new optional registry methods) keep `apiVersion` unchanged; only breaking changes bump it.

## Stable contract

These are the things you can rely on at `apiVersion: 1`:

- `api.registerGroupType(type)` — the type's `id`, `label`, `icon`, `color`, and `onFire(ctx)` semantics will not change in v1.
- `api.registerGameMode(mode)` — `id`, `label`, `blurb`, `defaultParams`, `buildDeck(ctx)`, and optional `SetupExtras` React component contract will not change in v1.
- `api.registerTileKind(kind)` — `renderContent`, `containerStyle`, `containerClassName`, `onTap`, `deckWildcards` semantics will not change in v1.

## Paid / proprietary plugins

If your plugin is paid, set `requiresEntitlement: true` on the manifest. The host MUST refuse to load it unless an `EntitlementResolver` is configured. See [`PLUGIN_ENTITLEMENT.md`](PLUGIN_ENTITLEMENT.md) for the full model — including the worked example for a store-distributed paid plugin and what's deliberately not part of the entitlement model yet (bundle signing, offline re-validation).

You can also attach `licenseInfo` to the manifest (display-only metadata: license, holder, distributor, contact URL).

## What plugins **cannot** do at v1

- Intercept playback flow control (no "skip rest of segment"). Group types only contribute audio for tiles in the group.
- Add tile kinds with a fundamentally new `Tile` shape — the TypeScript discriminated union is still closed at `'note' | 'repeat'`.
- Pause playback for interactive prompts (sing the pitch, dice rolls).
- Persist plugin-specific state outside the host's session file. (`gameParams` is per-session; per-plugin durable storage is a future addition.)

These limits will be addressed in future API versions. Expect at least one major bump when the prompt channel lands.

## Identifiers

Use **reverse-DNS** for the plugin `id` and for any registry id you contribute (e.g. game mode `id: 'com.acme.bluesgame'`). The core's built-ins use unprefixed ids (`'explorer'`, `'chord'`); plugins should prefix to avoid collisions with future built-ins or other plugins. The registry throws on duplicate ids.
