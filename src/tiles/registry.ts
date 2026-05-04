import type { TileKind, TileKindId } from './types';

const registry = new Map<TileKindId, TileKind>();

export function registerTileKind(kind: TileKind): void {
  if (registry.has(kind.id)) {
    throw new Error(`TileKind "${kind.id}" already registered`);
  }
  registry.set(kind.id, kind);
}

export function getTileKind(id: TileKindId): TileKind | undefined {
  return registry.get(id);
}

export function listTileKinds(): TileKind[] {
  return Array.from(registry.values());
}

export function _resetRegistryForTests(): void {
  registry.clear();
}
