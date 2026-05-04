import type { GameMode, GameModeId } from './types';

const registry = new Map<GameModeId, GameMode<any>>();

export function registerGameMode(mode: GameMode<any>): void {
  if (registry.has(mode.id)) {
    throw new Error(`GameMode "${mode.id}" already registered`);
  }
  registry.set(mode.id, mode);
}

export function getGameMode(id: GameModeId): GameMode<any> | undefined {
  return registry.get(id);
}

export function listGameModes(): GameMode<any>[] {
  return Array.from(registry.values());
}

export function _resetRegistryForTests(): void {
  registry.clear();
}
