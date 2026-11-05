import type { TriageItem, Triaged } from '../../capabilities/sources/index.js';

export interface BenchQuestion {
  stem: string;
  options: { letter: string; text: string }[];
  /** The file's answer. */
  answer: string;
}

const share = (part: number, whole: number) =>
  whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;

/** How the triage compares with the files' answers, and every question it settles differently. */
export function tally(
  questions: readonly BenchQuestion[],
  items: readonly TriageItem[],
  byId: ReadonlyMap<string, Triaged>,
) {
  const done = items.flatMap((item, index) => {
    const triaged = byId.get(item.question.id);
    return triaged ? [{ question: questions[index] as BenchQuestion, triaged }] : [];
  });
  const kinds = new Map<string, number>();
  for (const { triaged } of done)
    kinds.set(triaged.outcome.kind, (kinds.get(triaged.outcome.kind) ?? 0) + 1);
  const firstRight = done.filter((d) => d.triaged.first.letter === d.question.answer).length;
  const secondRight = done.filter((d) => d.triaged.second.letter === d.question.answer).length;
  const settled = done.length - (kinds.get('unsettled') ?? 0);
  return {
    summary: {
      questions: questions.length,
      triaged: done.length,
      outcomes: Object.fromEntries(kinds),
      solver1AgreesWithFile: `${share(firstRight, done.length)}%`,
      solver2AgreesWithFile: `${share(secondRight, done.length)}%`,
      settledWithoutPerson: `${share(settled, done.length)}%`,
    },
    differing: done
      .filter((d) => d.triaged.outcome.kind !== 'confirmed')
      .map(({ question, triaged }) => ({ ...question, ...triaged })),
  };
}
