import type { GroupType, GroupTypeId } from './types';

const registry = new Map<GroupTypeId, GroupType>();

export function registerGroupType(type: GroupType): void {
  if (registry.has(type.id)) {
    throw new Error(`GroupType "${type.id}" already registered`);
  }
  registry.set(type.id, type);
}

export function getGroupType(id: GroupTypeId): GroupType | undefined {
  return registry.get(id);
}

export function listGroupTypes(): GroupType[] {
  return Array.from(registry.values());
}

/** Test-only: drop all registrations. */
export function _resetRegistryForTests(): void {
  registry.clear();
}
