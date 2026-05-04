// examples/demo-plugin/index.ts
var PENTATONIC_PCS = [0, 2, 4, 7, 9];
var PENTATONIC_MODE = {
  id: "demo.pentatonic",
  label: "Pentatonic (demo)",
  blurb: "Five notes only \u2014 C major pentatonic. Loaded from the demo plugin.",
  defaultParams: {},
  buildDeck({ wildness, rng = Math.random }) {
    const tiles = {};
    const ids = [];
    let nextId = 0;
    const newId = () => `pent_${nextId++}`;
    for (const pc of PENTATONIC_PCS) {
      for (const base of [36, 48, 60, 72]) {
        const midi = base + pc;
        if (midi > 83) continue;
        for (let copy = 0; copy < 3; copy++) {
          const id = newId();
          tiles[id] = { id, kind: "note", pitch: midi, bass: false, cell: null };
          ids.push(id);
        }
      }
    }
    const wildnessRatio = { tame: 0.05, wild: 0.1, wilder: 0.15 };
    const wildcardCount = Math.round(ids.length * (wildnessRatio[wildness] ?? 0.1));
    for (let i = 0; i < wildcardCount; i++) {
      const id = newId();
      tiles[id] = { id, kind: "repeat", count: 1, cell: null };
      ids.push(id);
    }
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return { tiles, deck: ids, tray: [], discardedCount: 0 };
  }
};
var manifest = {
  apiVersion: 1,
  id: "doremino.demo",
  name: "Doremino Demo Plugin",
  version: "0.1.0",
  register(api) {
    api.registerGameMode(PENTATONIC_MODE);
  }
};
var demo_plugin_default = manifest;
export {
  demo_plugin_default as default
};
//# sourceMappingURL=demo.js.map
