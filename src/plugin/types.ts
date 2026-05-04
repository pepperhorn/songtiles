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
  /** Called once after compatibility checks pass. Plugins register their
   *  contributions to the core registries via `api`. */
  register(api: PluginAPI): void;
}
