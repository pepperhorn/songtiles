type PathItem = { id: string; kind: 'note' | 'repeat-open' | 'repeat-close'; count?: 1|2|3|4|'inf' };
export interface RepeatSpan { openIndex: number; closeIndex: number; count: 1|2|3|4|'inf' }

export function findRepeatSpans(path: PathItem[]): RepeatSpan[] {
  const stack: number[] = [];
  const out: RepeatSpan[] = [];
  for (let i = 0; i < path.length; i++) {
    const k = path[i].kind;
    if (k === 'repeat-open') stack.push(i);
    else if (k === 'repeat-close' && stack.length) {
      const open = stack.pop()!;
      out.push({ openIndex: open, closeIndex: i, count: (path[open].count ?? 1) });
    }
  }
  return out.sort((a, b) => a.openIndex - b.openIndex);
}
