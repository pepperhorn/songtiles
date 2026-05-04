import { describe, it, expect } from 'vitest';
import { createDeck, drawTo, returnToDeck, discardFromTray } from '../../src/state/deck';

describe('deck — explorer mode', () => {
  it('emits 12 instances of every pitch class (144 note tiles, no wildcards)', () => {
    const r = createDeck({ mode: 'explorer', wildness: 'tame' });
    const notes = Object.values(r.tiles).filter(t => t.kind === 'note');
    // Count instances per pitch class.
    const byPc: Record<number, number> = {};
    for (const t of notes) {
      if (t.kind !== 'note') continue;
      const pc = ((t.pitch % 12) + 12) % 12;
      byPc[pc] = (byPc[pc] ?? 0) + 1;
    }
    for (let pc = 0; pc < 12; pc++) {
      expect(byPc[pc]).toBe(12);
    }
    expect(notes).toHaveLength(144);
    for (const t of notes) {
      if (t.kind !== 'note') continue;
      expect(t.pitch).toBeGreaterThanOrEqual(36);
      expect(t.pitch).toBeLessThanOrEqual(83);
    }
  });

  it('wildness scales the wildcard count proportionally to notes', () => {
    const tame   = createDeck({ mode: 'explorer', wildness: 'tame' });
    const wild   = createDeck({ mode: 'explorer', wildness: 'wild' });
    const wilder = createDeck({ mode: 'explorer', wildness: 'wilder' });
    const w = (r: ReturnType<typeof createDeck>) =>
      Object.values(r.tiles).filter(t => t.kind === 'repeat').length;
    // 144 notes × {0.05, 0.10, 0.15} → 7, 14, 22.
    expect(w(tame)).toBe(7);
    expect(w(wild)).toBe(14);
    expect(w(wilder)).toBe(22);
    expect(tame.deck.length).toBe(151);
    expect(wild.deck.length).toBe(158);
    expect(wilder.deck.length).toBe(166);
  });
});

describe('deck — scale mode', () => {
  it('only includes scale pitch classes; 12 of each', () => {
    // C major: PCs 0, 2, 4, 5, 7, 9, 11. 7 PCs × 12 = 84 notes.
    const r = createDeck({ mode: 'scale', wildness: 'tame', scaleRoot: 0, scaleType: 'major' });
    const notes = Object.values(r.tiles).filter(t => t.kind === 'note');
    expect(notes).toHaveLength(84);
    const allowed = new Set([0, 2, 4, 5, 7, 9, 11]);
    const byPc: Record<number, number> = {};
    for (const t of notes) {
      if (t.kind !== 'note') continue;
      const pc = ((t.pitch % 12) + 12) % 12;
      expect(allowed.has(pc)).toBe(true);
      byPc[pc] = (byPc[pc] ?? 0) + 1;
    }
    for (const pc of allowed) expect(byPc[pc]).toBe(12);
  });
});

describe('deck — drawTo / returnToDeck / discardFromTray', () => {
  it('drawTo(record, 6) fills tray to 6 from the top of the deck', () => {
    const r = createDeck({ mode: 'explorer', wildness: 'tame' });
    const topSix = r.deck.slice(0, 6);
    const filled = drawTo(r, 6);
    expect(filled.tray).toHaveLength(6);
    expect(filled.tray).toEqual(topSix);
  });

  it('returnToDeck adds the tile id back to the bottom of the deck', () => {
    const filled = drawTo(createDeck({ mode: 'explorer', wildness: 'tame' }), 6);
    const returnedId = filled.tray[0];
    const after = returnToDeck(filled, returnedId);
    expect(after.tray).not.toContain(returnedId);
    expect(after.deck[after.deck.length - 1]).toBe(returnedId);
  });

  it('discardFromTray removes tile from tiles registry and increments discardedCount', () => {
    const filled = drawTo(createDeck({ mode: 'explorer', wildness: 'tame' }), 6);
    const discardedId = filled.tray[0];
    const after = discardFromTray(filled, discardedId);
    expect(after.tray).not.toContain(discardedId);
    expect(after.tiles[discardedId]).toBeUndefined();
    expect(after.discardedCount).toBe(1);
  });
});
