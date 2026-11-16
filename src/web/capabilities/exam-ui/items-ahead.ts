interface Placed {
  position: number;
  total: number;
}

interface Entry<T> {
  item: T | undefined;
}

/** Which neighbours are fetched ahead: always the next; the previous only where asked. */
export interface AheadSpan {
  previous: boolean;
}

/** The neighbours of `current` that exist and are fetched ahead. */
function neighboursOf(current: Placed, span: AheadSpan): number[] {
  const wanted = [current.position + 1];
  if (span.previous) wanted.push(current.position - 1);
  return wanted.filter((p) => p >= 0 && p < current.total);
}

/**
 * A small cache of questions around the one shown (M34 U3): the current one and its neighbours,
 * fetched ahead so "Next" shows at once. `peek` must be a read with no side effect, and returns
 * only what the solver may already see (the server decides). `warm` fetches its pictures.
 * Anything farther than one question away is forgotten.
 */
export function itemsAhead<T extends Placed>(
  peek: (position: number) => Promise<T>,
  warm: (item: T) => void,
  span: AheadSpan,
) {
  const entries = new Map<number, Entry<T>>();
  const fetchAhead = (position: number) => {
    const entry: Entry<T> = { item: undefined };
    entries.set(position, entry);
    peek(position).then(
      (item) => {
        if (entries.get(position) !== entry) return;
        entry.item = item;
        warm(item);
      },
      () => {
        if (entries.get(position) === entry) entries.delete(position);
      },
    );
  };
  return {
    /** The question at `position`, if it is here already. */
    ready: (position: number): T | undefined => entries.get(position)?.item,
    /** The question now shown (as it is now), and the fetching of its neighbours. */
    around(current: T) {
      const wanted = neighboursOf(current, span);
      for (const position of [...entries.keys()])
        if (position !== current.position && !wanted.includes(position)) entries.delete(position);
      entries.set(current.position, { item: current });
      for (const position of wanted) if (!entries.has(position)) fetchAhead(position);
    },
  };
}

export type ItemsAhead<T extends Placed> = ReturnType<typeof itemsAhead<T>>;
