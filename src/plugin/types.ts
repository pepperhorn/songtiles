import type { GroupType } from '../groups/types';
import type { GameMode } from '../games/types';
import type { TileKind } from '../tiles/types';

/**
 * Stable surface plugins call into. Add new optional methods in minor versions;
 * change or remove existing ones in a major version bump and document in
 * `docs/PLUGIN_API_CHANGELOG.md`.
 */
export interface PluginAPI {
  registerGroupType(type: GroupType): void;
  registerGameMode(mode: GameMode<unknown>): void;
  registerTileKind(kind: TileKind): void;
}

/** Optional licence metadata a plugin can carry. Free-form, for display in
 *  about-panels, store listings, debugging, etc. The host does not parse or
 *  enforce these strings — entitlement enforcement happens via the host's
 *  EntitlementResolver. */
export interface PluginLicenseInfo {
  /** SPDX id, "Proprietary", or any free-form string. */
  license?: string;
  /** Human-readable copyright holder. */
  holder?: string;
  /** Vendor/distributor (e.g. "Doremino Store"). */
  distributedBy?: string;
  /** Where users can buy or learn more. */
  contactUrl?: string;
}

/** A plugin manifest. The default export of a plugin bundle. */
export interface PluginManifest {
  /** Which major version of the core PluginAPI this plugin targets. */
  apiVersion: number;
  /** Globally-unique plugin id (use reverse-DNS, e.g. "com.acme.bluesgame"). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Plugin's own version (semver string, opaque to core). */
  version: string;
  /** True if the plugin is paid / requires an entitlement check. The host MUST
   *  refuse to load plugins with this flag set unless an EntitlementResolver
   *  is configured. Default: false (free plugin). */
  requiresEntitlement?: boolean;
  /** Optional licence metadata (display-only). */
  licenseInfo?: PluginLicenseInfo;
  /** Called once after compatibility checks pass. Plugins register their
   *  contributions to the core registries via `api`. */
  register(api: PluginAPI): void;
}

/** Result returned by an EntitlementResolver. */
export interface EntitlementCheck {
  allowed: boolean;
  /** Human-readable reason if denied. Surfaced in PluginLoadError.message. */
  reason?: string;
}

/** Host-supplied policy that decides whether a given manifest may be loaded.
 *  Called by the loader BEFORE the plugin's register() runs. */
export type EntitlementResolver = (
  manifest: PluginManifest,
) => Promise<EntitlementCheck> | EntitlementCheck;
