/**
 * Doremino Demo Plugin
 * --------------------
 * Adds a "Pentatonic" game mode that builds a deck of just the C major
 * pentatonic pitch classes (C, D, E, G, A) — proves the plugin loader path
 * end-to-end without depending on any core implementation helpers.
 *
 * Build to public/plugins/demo.js with:  npm run build:demo-plugin
 * Then load the app with:  /?plugin=/plugins/demo.js
 *
 * IMPORTANT: this file imports ONLY types from the core package. Runtime
 * symbols come through the `register(api)` callback. This is what lets the
 * plugin bundle externalize the core entirely.
 */
import type { PluginManifest, PluginAPI } from '../../src/plugin/types';
import type { GameMode } from '../../src/games/types';
import type { Tile, TileId } from '../../src/graph/types';

// C major pentatonic: C, D, E, G, A.
const PENTATONIC_PCS = [0, 2, 4, 7, 9];

const PENTATONIC_MODE: GameMode<{}> = {
  id: 'demo.pentatonic',
  label: 'Pentatonic (demo)',
  blurb: 'Five notes only — C major pentatonic. Loaded from the demo plugin.',
  defaultParams: {},
  buildDeck({ wildness, rng = Math.random }) {
    const tiles: Record<TileId, Tile> = {};
    const ids: TileId[] = [];
    let nextId = 0;
    const newId = () => `pent_${nextId++}`;

    for (const pc of PENTATONIC_PCS) {
      for (const base of [36, 48, 60, 72]) {
        const midi = base + pc;
        if (midi > 83) continue;
        for (let copy = 0; copy < 3; copy++) {
          const id = newId();
          tiles[id] = { id, kind: 'note', pitch: midi, bass: false, cell: null };
          ids.push(id);
        }
      }
    }

    const wildnessRatio: Record<string, number> = { tame: 0.05, wild: 0.10, wilder: 0.15 };
    const wildcardCount = Math.round(ids.length * (wildnessRatio[wildness] ?? 0.10));
    for (let i = 0; i < wildcardCount; i++) {
      const id = newId();
      tiles[id] = { id, kind: 'repeat', count: 1, cell: null };
      ids.push(id);
    }

    // Fisher-Yates shuffle.
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }

    return { tiles, deck: ids, tray: [], discardedCount: 0 };
  },
};

const manifest: PluginManifest = {
  apiVersion: 1,
  id: 'doremino.demo',
  name: 'Doremino Demo Plugin',
  version: '0.1.0',
  register(api: PluginAPI) {
    api.registerGameMode(PENTATONIC_MODE);
  },
};

export default manifest;
