import { registerGroupType } from '../groups/registry';
import { registerGameMode } from '../games/registry';
import { registerTileKind } from '../tiles/registry';
import type { PluginAPI, PluginManifest } from './types';

/**
 * Major version of the core PluginAPI. Bump when:
 *   - a method is removed or renamed
 *   - a method's signature changes incompatibly
 *   - the meaning of an existing parameter changes
 *
 * Document every bump in `docs/PLUGIN_API_CHANGELOG.md`.
 */
export const CURRENT_API_VERSION = 1;

/**
 * Oldest version of the API that this core can still load plugins for.
 * Set equal to CURRENT_API_VERSION until we have backward-compat shims to
 * support older versions; raise to deprecate older plugin bundles.
 */
export const MIN_SUPPORTED_API_VERSION = 1;

/** Frozen reference to the core API surface, passed to plugin.register(). */
export const PLUGIN_API: PluginAPI = Object.freeze({
  registerGroupType,
  registerGameMode,
  registerTileKind,
});

/**
 * Plugin authors call this to declare their manifest. It returns the manifest
 * unchanged today; reserved for future ergonomics (validation, type narrowing).
 */
export function definePlugin(manifest: PluginManifest): PluginManifest {
  return manifest;
}
