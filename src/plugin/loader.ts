import {
  CURRENT_API_VERSION, MIN_SUPPORTED_API_VERSION, PLUGIN_API,
} from './api';
import type { PluginManifest } from './types';

const loaded = new Set<string>();

export class PluginLoadError extends Error {
  constructor(message: string, public url: string, public cause?: unknown) {
    super(message);
    this.name = 'PluginLoadError';
  }
}

/** Internal — exported for tests. Throws PluginLoadError on invalid input. */
export function _validateManifest(m: unknown, url: string): PluginManifest {
  return validateManifest(m, url);
}

/** Internal — exported for tests. Throws PluginLoadError on incompatible version. */
export function _checkApiCompatibility(manifest: PluginManifest, url: string): void {
  checkApiCompatibility(manifest, url);
}

function validateManifest(m: unknown, url: string): PluginManifest {
  if (!m || typeof m !== 'object') {
    throw new PluginLoadError('Plugin module did not export a manifest object', url);
  }
  const obj = m as Record<string, unknown>;
  for (const f of ['apiVersion', 'id', 'name', 'version', 'register']) {
    if (!(f in obj)) {
      throw new PluginLoadError(`Plugin manifest is missing required field "${f}"`, url);
    }
  }
  if (typeof obj.apiVersion !== 'number') {
    throw new PluginLoadError('Plugin manifest "apiVersion" must be a number', url);
  }
  if (typeof obj.register !== 'function') {
    throw new PluginLoadError('Plugin manifest "register" must be a function', url);
  }
  return obj as unknown as PluginManifest;
}

function checkApiCompatibility(manifest: PluginManifest, url: string): void {
  if (manifest.apiVersion > CURRENT_API_VERSION) {
    throw new PluginLoadError(
      `Plugin "${manifest.id}" requires PluginAPI v${manifest.apiVersion}, ` +
      `but this app supports up to v${CURRENT_API_VERSION}. Update the app.`,
      url,
    );
  }
  if (manifest.apiVersion < MIN_SUPPORTED_API_VERSION) {
    throw new PluginLoadError(
      `Plugin "${manifest.id}" targets PluginAPI v${manifest.apiVersion}, ` +
      `but this app no longer supports versions below v${MIN_SUPPORTED_API_VERSION}. ` +
      `Update the plugin.`,
      url,
    );
  }
}

/**
 * Dynamically import a plugin from `url` and register it. The url must serve
 * an ESM bundle whose default export is a `PluginManifest`. Idempotent on
 * plugin id.
 */
export async function loadPlugin(url: string): Promise<PluginManifest> {
  let mod: { default?: unknown };
  try {
    mod = await import(/* @vite-ignore */ url);
  } catch (err) {
    throw new PluginLoadError(`Failed to fetch plugin bundle`, url, err);
  }

  const manifest = validateManifest(mod.default, url);
  checkApiCompatibility(manifest, url);

  if (loaded.has(manifest.id)) {
    // eslint-disable-next-line no-console
    console.warn(`Plugin "${manifest.id}" already loaded — skipping`);
    return manifest;
  }

  try {
    manifest.register(PLUGIN_API);
  } catch (err) {
    throw new PluginLoadError(
      `Plugin "${manifest.id}" threw during register()`, url, err,
    );
  }
  loaded.add(manifest.id);
  return manifest;
}

/**
 * Load every plugin specified via `?plugin=URL` query-string params on the
 * current page. Errors are caught per-plugin and logged, so one bad bundle
 * doesn't prevent others from loading.
 */
export async function loadPluginsFromQuery(): Promise<void> {
  if (typeof window === 'undefined') return;
  const urls = new URLSearchParams(window.location.search).getAll('plugin');
  for (const url of urls) {
    try {
      await loadPlugin(url);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[plugin]', err);
    }
  }
}

/** Test-only. */
export function _resetLoadedPluginsForTests(): void {
  loaded.clear();
}
