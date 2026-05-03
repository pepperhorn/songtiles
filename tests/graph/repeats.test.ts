import { describe, it, expect } from 'vitest';
import { findRepeatSpans } from '../../src/graph/repeats';

describe('findRepeatSpans', () => {
  it('returns empty when there is no repeat marker', () => {
    expect(findRepeatSpans([
      { id: 'a', kind: 'note' },
      { id: 'b', kind: 'note' },
    ])).toEqual([]);
  });

  it('a single repeat triggers a loop over every preceding tile', () => {
    const spans = findRepeatSpans([
      { id: 'a',  kind: 'note' },
      { id: 'b',  kind: 'note' },
      { id: 'r',  kind: 'repeat', count: 3 },
    ]);
    expect(spans).toEqual([
      { innerStart: 0, innerEnd: 2, repeatIndex: 2, count: 3 },
    ]);
  });

  it('two repeats produce two adjacent spans (each replays the run since the previous repeat)', () => {
    const spans = findRepeatSpans([
      { id: 'a',  kind: 'note' },
      { id: 'r1', kind: 'repeat', count: 2 },
      { id: 'b',  kind: 'note' },
      { id: 'c',  kind: 'note' },
      { id: 'r2', kind: 'repeat', count: 4 },
    ]);
    expect(spans).toEqual([
      { innerStart: 0, innerEnd: 1, repeatIndex: 1, count: 2 },
      { innerStart: 2, innerEnd: 4, repeatIndex: 4, count: 4 },
    ]);
  });
});
