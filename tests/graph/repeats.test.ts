import { describe, it, expect } from 'vitest';
import { findRepeatSpans } from '../../src/graph/repeats';

describe('findRepeatSpans', () => {
  it('returns empty for path without close tiles', () => {
    expect(findRepeatSpans([{ id: 'o', kind: 'repeat-open', count: 2 }])).toEqual([]);
  });
  it('matches a simple open/close pair', () => {
    const spans = findRepeatSpans([
      { id: 'n1', kind: 'note' },
      { id: 'o',  kind: 'repeat-open', count: 3 },
      { id: 'n2', kind: 'note' },
      { id: 'c',  kind: 'repeat-close' },
      { id: 'n3', kind: 'note' },
    ]);
    expect(spans).toEqual([{ openIndex: 1, closeIndex: 3, count: 3 }]);
  });
  it('handles nested repeats — innermost matches with closest close', () => {
    const spans = findRepeatSpans([
      { id: 'o1', kind: 'repeat-open', count: 2 },
      { id: 'o2', kind: 'repeat-open', count: 3 },
      { id: 'c1', kind: 'repeat-close' },
      { id: 'c2', kind: 'repeat-close' },
    ]);
    // Inner span (o2..c1) opens at index 1, closes at 2.
    // Outer span (o1..c2) opens at 0, closes at 3.
    expect(spans).toEqual([
      { openIndex: 0, closeIndex: 3, count: 2 },
      { openIndex: 1, closeIndex: 2, count: 3 },
    ]);
  });
  it('skips unmatched open tiles silently', () => {
    const spans = findRepeatSpans([
      { id: 'o1', kind: 'repeat-open', count: 2 },
      { id: 'n1', kind: 'note' },
    ]);
    expect(spans).toEqual([]);
  });
});
