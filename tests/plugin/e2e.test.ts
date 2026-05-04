import { describe, it, expect, beforeEach } from 'vitest';
import { loadPlugin, _resetLoadedPluginsForTests } from '../../src/plugin/loader';
import { listGameModes, _resetRegistryForTests } from '../../src/games/registry';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const here = dirname(fileURLToPath(import.meta.url));

describe('end-to-end plugin load', () => {
  beforeEach(() => {
    _resetLoadedPluginsForTests();
    _resetRegistryForTests();
  });

  it('loads the demo plugin bundle and registers its game mode', async () => {
    const bundlePath = resolve(here, '..', '..', 'public', 'plugins', 'demo.js');
    const dataUrl = 'data:text/javascript;base64,' +
      Buffer.from(readFileSync(bundlePath)).toString('base64');
    await loadPlugin(dataUrl);
    const ids = listGameModes().map(m => m.id);
    expect(ids).toContain('demo.pentatonic');
  });
});
