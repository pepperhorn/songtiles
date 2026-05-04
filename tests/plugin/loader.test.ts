import { describe, it, expect } from 'vitest';
import {
  _validateManifest, _checkApiCompatibility, PluginLoadError,
} from '../../src/plugin/loader';
import { CURRENT_API_VERSION } from '../../src/plugin/api';

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
