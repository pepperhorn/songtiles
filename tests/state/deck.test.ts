import { describe, it, expect } from 'vitest';
import { createDeck, drawTo, returnToDeck, discardFromTray } from '../../src/state/deck';

describe('deck', () => {
  it('createDeck produces 144 note tiles with pitches in MIDI 36..84', () => {
    const r = createDeck();
    expect(r.deck).toHaveLength(144);
    expect(r.tray).toHaveLength(0);
    expect(r.discardedCount).toBe(0);
    expect(Object.keys(r.tiles)).toHaveLength(144);
    for (const tile of Object.values(r.tiles)) {
      expect(tile.kind).toBe('note');
      expect(tile.pitch).toBeGreaterThanOrEqual(36);
      expect(tile.pitch).toBeLessThanOrEqual(84);
      expect(tile.cell).toBeNull();
    }
  });

  it('drawTo(record, 6) fills tray to 6 from the top of the deck', () => {
    const r = createDeck();
    const topSix = r.deck.slice(0, 6);
    const filled = drawTo(r, 6);
    expect(filled.tray).toHaveLength(6);
    expect(filled.tray).toEqual(topSix);
    expect(filled.deck).toHaveLength(138);
  });

  it('returnToDeck adds the tile id back to the bottom of the deck', () => {
    const filled = drawTo(createDeck(), 6);
    const returnedId = filled.tray[0];
    const after = returnToDeck(filled, returnedId);
    expect(after.tray).not.toContain(returnedId);
    expect(after.deck[after.deck.length - 1]).toBe(returnedId);
    expect(after.deck).toHaveLength(139);
  });

  it('discardFromTray removes tile from tiles registry and increments discardedCount', () => {
    const filled = drawTo(createDeck(), 6);
    const discardedId = filled.tray[0];
    const after = discardFromTray(filled, discardedId);
    expect(after.tray).not.toContain(discardedId);
    expect(after.tiles[discardedId]).toBeUndefined();
    expect(after.discardedCount).toBe(1);
  });
});
