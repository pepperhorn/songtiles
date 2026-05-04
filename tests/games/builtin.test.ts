import { describe, it, expect } from 'vitest';
import { EXPLORER_MODE } from '../../src/games/builtin/explorer';
import { SCALE_MODE } from '../../src/games/builtin/scale';

const seededRng = (seed = 1) => () => {
  // Simple deterministic LCG; only needs to be reproducible.
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0xffffffff;
};

describe('explorer mode', () => {
  it('builds a deck containing 12 instances of every chromatic pitch class', () => {
    const deck = EXPLORER_MODE.buildDeck({ wildness: 'tame', params: {}, rng: seededRng() });
    const notes = Object.values(deck.tiles).filter(t => t.kind === 'note');
    // 12 PCs × 4 octaves × 3 copies = 144.
    expect(notes.length).toBe(144);
    // Each PC appears 12 times.
    const counts = new Map<number, number>();
    for (const n of notes) {
      if (n.kind !== 'note') continue;
      const pc = ((n.pitch % 12) + 12) % 12;
      counts.set(pc, (counts.get(pc) ?? 0) + 1);
    }
    for (let pc = 0; pc < 12; pc++) expect(counts.get(pc)).toBe(12);
  });

  it('mixes in repeat wildcards proportional to wildness', () => {
    const tame = EXPLORER_MODE.buildDeck({ wildness: 'tame', params: {}, rng: seededRng() });
    const wilder = EXPLORER_MODE.buildDeck({ wildness: 'wilder', params: {}, rng: seededRng() });
    const repeats = (d: typeof tame) => Object.values(d.tiles).filter(t => t.kind === 'repeat').length;
    expect(repeats(tame)).toBe(Math.round(144 * 0.05));
    expect(repeats(wilder)).toBe(Math.round(144 * 0.15));
  });
});

describe('scale mode', () => {
  it('builds a deck containing only PCs in the chosen scale', () => {
    // C major = {0,2,4,5,7,9,11}
    const deck = SCALE_MODE.buildDeck({
      wildness: 'tame', params: { root: 0, type: 'major' }, rng: seededRng(),
    });
    const notes = Object.values(deck.tiles).filter(t => t.kind === 'note');
    const pcs = new Set(notes.map(n => n.kind === 'note' ? ((n.pitch % 12) + 12) % 12 : -1));
    expect([...pcs].sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]);
    // 7 PCs × 12 instances = 84.
    expect(notes.length).toBe(84);
  });

  it('throws when params are missing or malformed', () => {
    expect(() =>
      SCALE_MODE.buildDeck({ wildness: 'tame', params: {} })
    ).toThrow();
  });
});
