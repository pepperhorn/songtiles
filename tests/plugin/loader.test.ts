import { describe, it, expect, afterEach } from 'vitest';
import {
  _validateManifest, _checkApiCompatibility, _checkEntitlement, PluginLoadError,
  setEntitlementResolver,
} from '../../src/plugin/loader';
import { CURRENT_API_VERSION } from '../../src/plugin/api';
import type { PluginManifest } from '../../src/plugin/types';

describe('plugin manifest validation', () => {
  it('accepts a well-formed manifest', () => {
    const m = {
      apiVersion: 1, id: 'x', name: 'X', version: '0.1.0', register: () => {},
    };
    expect(_validateManifest(m, 'u')).toBe(m);
  });

  it.each([
    ['null',           null],
    ['undefined',      undefined],
    ['number',         42],
    ['empty object',   {}],
  ])('rejects %s with PluginLoadError', (_label, bad) => {
    expect(() => _validateManifest(bad, 'u')).toThrow(PluginLoadError);
  });

  it('rejects manifest missing required fields', () => {
    expect(() =>
      _validateManifest({ apiVersion: 1, id: 'x' }, 'u')
    ).toThrow(/missing required field/);
  });

  it('rejects non-numeric apiVersion', () => {
    expect(() =>
      _validateManifest(
        { apiVersion: '1', id: 'x', name: 'X', version: '0', register: () => {} },
        'u',
      )
    ).toThrow(/apiVersion.*number/);
  });

  it('rejects non-function register', () => {
    expect(() =>
      _validateManifest(
        { apiVersion: 1, id: 'x', name: 'X', version: '0', register: 'nope' },
        'u',
      )
    ).toThrow(/register.*function/);
  });
});

describe('plugin entitlement', () => {
  const baseManifest: PluginManifest = {
    apiVersion: 1, id: 'p', name: 'P', version: '0.1.0', register: () => {},
  };

  afterEach(() => setEntitlementResolver(null));

  it('passes through when no resolver and plugin is free', async () => {
    await expect(_checkEntitlement(baseManifest, 'u')).resolves.toBeUndefined();
  });

  it('rejects paid plugin when no resolver is configured', async () => {
    await expect(
      _checkEntitlement({ ...baseManifest, requiresEntitlement: true }, 'u')
    ).rejects.toThrow(/no EntitlementResolver/);
  });

  it('passes through when resolver returns allowed:true', async () => {
    setEntitlementResolver(() => ({ allowed: true }));
    await expect(
      _checkEntitlement({ ...baseManifest, requiresEntitlement: true }, 'u')
    ).resolves.toBeUndefined();
  });

  it('rejects with the resolver-supplied reason when allowed:false', async () => {
    setEntitlementResolver(() => ({ allowed: false, reason: 'subscription expired' }));
    await expect(
      _checkEntitlement({ ...baseManifest, requiresEntitlement: true }, 'u')
    ).rejects.toThrow(/subscription expired/);
  });

  it('runs the resolver even for free plugins (host policy can override)', async () => {
    let called = false;
    setEntitlementResolver(() => { called = true; return { allowed: true }; });
    await _checkEntitlement(baseManifest, 'u');
    expect(called).toBe(true);
  });

  it('wraps resolver exceptions in PluginLoadError', async () => {
    setEntitlementResolver(() => { throw new Error('backend down'); });
    await expect(
      _checkEntitlement({ ...baseManifest, requiresEntitlement: true }, 'u')
    ).rejects.toThrow(PluginLoadError);
  });

  it('supports async resolvers', async () => {
    setEntitlementResolver(async () => {
      await new Promise(r => setTimeout(r, 0));
      return { allowed: false, reason: 'async denial' };
    });
    await expect(
      _checkEntitlement({ ...baseManifest, requiresEntitlement: true }, 'u')
    ).rejects.toThrow(/async denial/);
  });
});

describe('plugin API compatibility', () => {
  const baseManifest = {
    id: 'x', name: 'X', version: '0.1.0', register: () => {},
  };

  it('accepts a manifest at the current API version', () => {
    expect(() =>
      _checkApiCompatibility({ ...baseManifest, apiVersion: CURRENT_API_VERSION }, 'u')
    ).not.toThrow();
  });

  it('rejects a manifest targeting a future API version', () => {
    expect(() =>
      _checkApiCompatibility({ ...baseManifest, apiVersion: CURRENT_API_VERSION + 1 }, 'u')
    ).toThrow(/requires PluginAPI v/);
  });

  it('rejects a manifest below the minimum supported version', () => {
    expect(() =>
      _checkApiCompatibility({ ...baseManifest, apiVersion: 0 }, 'u')
    ).toThrow(/no longer supports versions below/);
  });
});
