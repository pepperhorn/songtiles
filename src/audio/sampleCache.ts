import { CacheStorage } from 'smplr';

// ---------------------------------------------------------------------------
// Singleton CacheStorage — passed to every smplr constructor
// ---------------------------------------------------------------------------

let _storage: CacheStorage | null = null;

export function getStorage(): CacheStorage {
  if (!_storage) _storage = new CacheStorage();
  return _storage;
}

// ---------------------------------------------------------------------------
// Cached-patch manifest (localStorage-backed, keyed by patch name)
// ---------------------------------------------------------------------------

const MANIFEST_KEY = 'doremino-cached-patches';

function loadManifest(): Set<string> {
  try {
    const raw = localStorage.getItem(MANIFEST_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveManifest(set: Set<string>) {
  try {
    localStorage.setItem(MANIFEST_KEY, JSON.stringify([...set]));
  } catch {
    // localStorage may be unavailable (SSR, private mode quota, etc.)
  }
}

let _manifest: Set<string> | null = null;

function getManifest(): Set<string> {
  if (!_manifest) _manifest = loadManifest();
  return _manifest;
}

export function markCached(patchName: string): void {
  const m = getManifest();
  m.add(patchName);
  saveManifest(m);
}

export function removeCached(patchName: string): void {
  const m = getManifest();
  m.delete(patchName);
  saveManifest(m);
}

export function isCached(patchName: string): boolean {
  return getManifest().has(patchName);
}
