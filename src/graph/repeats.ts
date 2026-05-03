type PathItem = { id: string; kind: 'note' | 'repeat'; count?: 1|2|3|4|'inf' };

/**
 * A repeat span describes a contiguous block of tiles that should replay
 * before any branching. `innerStart..innerEnd` is the (exclusive end) range
 * of tiles to play each pass; `repeatIndex` is the position of the repeat
 * marker that triggered the loop (consumes 0 beats).
 */
export interface RepeatSpan {
  innerStart: number;
  innerEnd: number;
  repeatIndex: number;
  count: 1|2|3|4|'inf';
}

/**
 * Find repeat spans in a segment path. Each `repeat` tile in the path
 * triggers a loop over every preceding tile back to the start of the
 * segment (or the previous repeat). The repeat tile itself is a 0-beat
 * marker — it doesn't add a beat, but its count is honoured.
 */
export function findRepeatSpans(path: PathItem[]): RepeatSpan[] {
  const out: RepeatSpan[] = [];
  let last = 0;
  for (let i = 0; i < path.length; i++) {
    if (path[i].kind !== 'repeat') continue;
    out.push({
      innerStart: last,
      innerEnd: i,
      repeatIndex: i,
      count: path[i].count ?? 1,
    });
    last = i + 1;
  }
  return out;
}
