import { describe, it, expect } from 'vitest';
import { findRepeatSpans } from '../../src/graph/repeats';

describe('findRepeatSpans', () => {
  it('returns empty for a lone repeat (no partner)', () => {
    expect(findRepeatSpans([{ id: 'o', kind: 'repeat', count: 2 }])).toEqual([]);
  });
  it('matches the first two repeats as an open/close pair (count from open)', () => {
    const spans = findRepeatSpans([
      { id: 'n1', kind: 'note' },
      { id: 'r1', kind: 'repeat', count: 3 },
      { id: 'n2', kind: 'note' },
      { id: 'r2', kind: 'repeat', count: 1 },
      { id: 'n3', kind: 'note' },
    ]);
    expect(spans).toEqual([{ openIndex: 1, closeIndex: 3, count: 3 }]);
  });
  it('four repeats yield two adjacent (non-nested) pairs', () => {
    const spans = findRepeatSpans([
      { id: 'a', kind: 'repeat', count: 2 },
      { id: 'b', kind: 'repeat', count: 1 },
      { id: 'c', kind: 'repeat', count: 4 },
      { id: 'd', kind: 'repeat', count: 1 },
    ]);
    expect(spans).toEqual([
      { openIndex: 0, closeIndex: 1, count: 2 },
      { openIndex: 2, closeIndex: 3, count: 4 },
    ]);
  });
  it('skips a final unmatched repeat silently', () => {
    const spans = findRepeatSpans([
      { id: 'r1', kind: 'repeat', count: 2 },
      { id: 'n1', kind: 'note' },
    ]);
    expect(spans).toEqual([]);
  });
});
