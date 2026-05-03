type PathItem = { id: string; kind: 'note' | 'repeat'; count?: 1|2|3|4|'inf' };
export interface RepeatSpan { openIndex: number; closeIndex: number; count: 1|2|3|4|'inf' }

/**
 * Find repeat spans in a segment path. Repeats are now generic markers that
 * pair up positionally along the path: the first repeat starts a section,
 * the next repeat closes it. Subsequent repeats start a fresh pair (so two
 * repeats then two more repeats yields two adjacent sections, not nested).
 *
 * The section's loop count is taken from the OPEN-side repeat tile's count.
 */
export function findRepeatSpans(path: PathItem[]): RepeatSpan[] {
  const out: RepeatSpan[] = [];
  let openIdx: number | null = null;
  for (let i = 0; i < path.length; i++) {
    if (path[i].kind !== 'repeat') continue;
    if (openIdx === null) {
      openIdx = i;
    } else {
      out.push({ openIndex: openIdx, closeIndex: i, count: (path[openIdx].count ?? 1) });
      openIdx = null;
    }
  }
  return out;
}
