# Plugin API Changelog

The plugin API has its own integer version tracked by `CURRENT_API_VERSION` in `src/plugin/api.ts`. Plugins declare which version they target via `apiVersion` on their manifest. The loader rejects manifests outside the `[MIN_SUPPORTED_API_VERSION, CURRENT_API_VERSION]` range.

**Versioning policy:**
- **Major (v2, v3, …)** — breaking change: a method removed, renamed, or changed incompatibly. Old plugins must be re-released against the new API.
- **Non-breaking additions** to the API (a new `register*` method, new optional fields) **do not** bump the version. Existing plugins keep working.
- A version is "removed" when `MIN_SUPPORTED_API_VERSION` is raised above it. Old bundles get a clear "no longer supported" error.

## v1 (2026-05-04) — additions

Non-breaking additions (no version bump):

- `PluginManifest.requiresEntitlement?: boolean` — paid-plugin self-declaration.
- `PluginManifest.licenseInfo?: PluginLicenseInfo` — display-only license metadata.
- `EntitlementResolver` host-side hook + `setEntitlementResolver()`.

See [`PLUGIN_ENTITLEMENT.md`](PLUGIN_ENTITLEMENT.md) for the full model.

## v1 (2026-05-04) — initial release

The first stable plugin API. Plugins receive a `PluginAPI` with three `register*` entry points.

```ts
interface PluginAPI {
  registerGroupType(type: GroupType): void;
  registerGameMode(mode: GameMode<unknown>): void;
  registerTileKind(kind: TileKind): void;
}

interface PluginManifest {
  apiVersion: 1;
  id: string;
  name: string;
  version: string;
  register(api: PluginAPI): void;
}
```

Built-in registries:
- `GroupType` — chord, arp + plugin contributions
- `GameMode` — explorer, scale + plugin contributions
- `TileKind` — note, repeat + plugin contributions (visual layer only; `Tile` TS union is still closed)

Known limits inherited from the registries themselves:
- Group types cannot intercept playback flow (no "skip rest of segment", no async prompts).
- Tile kinds added by plugins must currently use one of the existing TS-narrowed `kind` values (`'note'` | `'repeat'`); the union will be opened in a future API revision.
- No interactive prompt channel (sing-pitch / dice gameplay deferred).

These will be addressed in future API versions; expect at least one major bump when the prompt channel and open `Tile` union land.
