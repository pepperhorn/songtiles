import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerGroupType, getGroupType, listGroupTypes, _resetRegistryForTests,
} from '../../src/groups/registry';
import type { GroupType } from '../../src/groups/types';

const dummy: GroupType = {
  id: 'dummy', label: 'Dummy', icon: '?', color: '#000',
  onFire: () => {},
};

describe('group registry', () => {
  beforeEach(() => _resetRegistryForTests());

  it('registers and retrieves a group type', () => {
    registerGroupType(dummy);
    expect(getGroupType('dummy')).toBe(dummy);
  });

  it('lists registered types in registration order', () => {
    const a = { ...dummy, id: 'a' };
    const b = { ...dummy, id: 'b' };
    registerGroupType(a);
    registerGroupType(b);
    expect(listGroupTypes().map(t => t.id)).toEqual(['a', 'b']);
  });

  it('throws when registering a duplicate id', () => {
    registerGroupType(dummy);
    expect(() => registerGroupType(dummy)).toThrow(/already registered/);
  });

  it('returns undefined for unknown ids', () => {
    expect(getGroupType('nope')).toBeUndefined();
  });
});
