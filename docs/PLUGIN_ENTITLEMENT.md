# Plugin Entitlement

Doremino's core is MIT-licensed. Plugins, however, can be paid, closed-source, and require user-specific entitlement before loading. This document describes the entitlement model, how a host configures it, and what's deliberately *not* part of the model yet.

For the API surface, see [`PLUGIN_AUTHORING.md`](PLUGIN_AUTHORING.md). For the version history, see [`PLUGIN_API_CHANGELOG.md`](PLUGIN_API_CHANGELOG.md).

## Roles

- **Plugin author** declares whether their plugin requires entitlement by setting `requiresEntitlement: true` on the manifest. This is a self-declaration — the plugin author is saying "this is a paid plugin and the host MUST gate me."
- **Host application** decides the policy: which users may load which plugins. This is expressed as an `EntitlementResolver` registered with the loader.
- **Loader** enforces: `requiresEntitlement: true` + no resolver = refuse to load. With a resolver, every load consults it; the resolver decides.

## The contract

```ts
interface EntitlementCheck {
  allowed: boolean;
  reason?: string;          // surfaced in the error if denied
}

type EntitlementResolver = (manifest: PluginManifest)
  => Promise<EntitlementCheck> | EntitlementCheck;

setEntitlementResolver(fn);  // configure once at boot
```

The resolver receives the full manifest — including `id`, `version`, `licenseInfo`, and the `requiresEntitlement` flag — so it can:

- Look up `manifest.id` against a per-user license backend.
- Check a JWT or signed token in localStorage.
- Validate against a hard-coded allowlist.
- Return `{ allowed: false, reason: 'subscription expired' }` and have the user see a clear message.

## Behavior matrix

| `requiresEntitlement` | Resolver configured? | Resolver result | Outcome |
|---|---|---|---|
| false / omitted | none | n/a | ✅ Loaded (free plugin, no policy) |
| false / omitted | configured | `allowed: true` | ✅ Loaded (host opted to check anyway) |
| false / omitted | configured | `allowed: false` | ❌ Refused (host policy override) |
| **true** | **none** | n/a | ❌ **Refused** (safety net — paid plugin won't run free) |
| true | configured | `allowed: true` | ✅ Loaded |
| true | configured | `allowed: false` | ❌ Refused with `reason` |
| true | configured | resolver throws | ❌ Refused (treated as denial; original error wrapped) |

The "host opted to check anyway" row is intentional: a host can apply policy even to free plugins (e.g. an enterprise allowlist of approved community plugins). The plugin's `requiresEntitlement` flag is a *minimum* requirement, not a maximum.

## Worked example: paid plugin distributed through a store

**Plugin author** ships their bundle:

```ts
const manifest: PluginManifest = {
  apiVersion: 1,
  id: 'com.acme.bluesgame',
  name: 'Blues Game',
  version: '1.0.0',
  requiresEntitlement: true,
  licenseInfo: {
    license: 'Proprietary',
    holder: 'Acme Music Co.',
    distributedBy: 'Doremino Store',
    contactUrl: 'https://store.doremino.app/blues',
  },
  register(api) { /* register game mode */ },
};
export default manifest;
```

**Host** configures the resolver at boot:

```ts
import { setEntitlementResolver } from './plugin/loader';

setEntitlementResolver(async (manifest) => {
  const token = localStorage.getItem('doremino.license');
  if (!token) return { allowed: false, reason: 'sign in to load paid plugins' };
  const res = await fetch('/api/entitlements/check', {
    method: 'POST',
    body: JSON.stringify({ pluginId: manifest.id, token }),
  });
  const data = await res.json();
  return { allowed: !!data.allowed, reason: data.reason };
});
```

**End user** experience: navigates to `/?plugin=https://cdn.acme.com/blues.js`. Host fetches the bundle, validates the manifest, calls the resolver. Resolver checks the user's token against the backend. Backend says yes → plugin's `register()` runs, "Blues Game" mode appears in the setup modal. Backend says no → `PluginLoadError` is thrown with the `reason` from the backend, surfaced in the host's error UI.

## What's NOT part of the model (yet)

These are deliberate omissions, listed so you can plan around them.

### 1. Bundle integrity / signing

The loader fetches whatever URL it's given and trusts that the bundle's manifest is authentic. There is no:

- Cryptographic signature on the bundle proving it came from a particular author.
- Hash check between the manifest and a trusted registry.
- Tamper-detection if the CDN serves a modified bundle.

If you need integrity guarantees for paid distribution, today the host has to enforce it out-of-band: serve plugins from a domain you control, use Subresource Integrity hashes in the URL, or have your entitlement backend return a signed bundle URL pinned to a content hash. Native signature verification is a future plan and will likely be a major plugin-API bump.

### 2. License token format

The model is policy-agnostic — your resolver can use whatever scheme works (JWT, opaque tokens, hardware-bound licenses, server round-trip). Doremino does not bundle a token implementation.

### 3. Offline / re-validation

Resolvers are called once per `loadPlugin` call, before `register()`. If a plugin is loaded and the user's entitlement later expires, the plugin keeps running until the next reload. There is no live re-validation hook today.

### 4. Per-feature gating inside a plugin

Entitlement is binary at the plugin level: load or refuse. If a plugin wants to gate features within itself (e.g. "free tier registers 1 game mode, paid tier registers 3"), the plugin author handles that internally — typically by branching in `register(api)` based on a license value the resolver communicates. (To pass entitlement metadata back into `register`, the plugin author and host author need to agree on a side channel; the core PluginAPI doesn't pipe this through today.)

## Recommendations

- **Free plugins**: omit `requiresEntitlement` (or set it to `false`). Don't include `licenseInfo` unless it's interesting (most free plugins are MIT/Apache and the README is enough).
- **Paid plugins**: always set `requiresEntitlement: true` and provide a `licenseInfo.contactUrl` users can visit if blocked.
- **Hosts shipping commercial apps**: configure a real resolver before *any* `loadPlugin` call. Treat the "no resolver" safety-net error as a configuration bug, not a runtime condition.
- **Reverse-DNS plugin ids** (`com.acme.bluesgame`) make entitlement records portable across hosts/stores.
