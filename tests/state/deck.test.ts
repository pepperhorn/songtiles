import { describe, it, expect } from 'vitest';
import { createDeck, drawTo, returnToDeck, discardFromTray } from '../../src/state/deck';

describe('deck', () => {
  it('createDeck produces 144 note tiles with pitches in MIDI 36..84', () => {
    const record = createDeck();

    expect(record.order).toHaveLength(144);
    expect(record.tray).toHaveLength(0);
    expect(record.discardedCount).toBe(0);
    expect(record.registry.size).toBe(144);

    for (const tile of record.registry.values()) {
      expect(tile.kind).toBe('note');
      expect(tile.pitch).toBeGreaterThanOrEqual(36);
      expect(tile.pitch).toBeLessThanOrEqual(84);
      expect(tile.cell).toBeNull();
    }
  });

  it('drawTo(record, 6) fills tray to 6 from the top of the deck', () => {
    const record = createDeck();
    const topSix = record.order.slice(0, 6);
    const filled = drawTo(record, 6);

    expect(filled.tray).toHaveLength(6);
    expect(filled.tray).toEqual(topSix);
    expect(filled.order).toHaveLength(138);
  });

  it('returnToDeck adds the tile id back to the bottom of the deck', () => {
    const record = createDeck();
    const filled = drawTo(record, 6);
    const returnedId = filled.tray[0];
    const afterReturn = returnToDeck(filled, returnedId);

    expect(afterReturn.tray).not.toContain(returnedId);
    expect(afterReturn.order[afterReturn.order.length - 1]).toBe(returnedId);
    expect(afterReturn.order).toHaveLength(139); // 138 + 1 returned
  });

  it('discardFromTray removes tile from registry and increments discardedCount', () => {
    const record = createDeck();
    const filled = drawTo(record, 6);
    const discardedId = filled.tray[0];
    const afterDiscard = discardFromTray(filled, discardedId);

    expect(afterDiscard.tray).not.toContain(discardedId);
    expect(afterDiscard.registry.has(discardedId)).toBe(false);
    expect(afterDiscard.discardedCount).toBe(1);
  });
});
