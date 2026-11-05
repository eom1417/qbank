/**
 * A deterministic stand-in for the AI's question work (DEC-33, DEC-34). A solver and the judge
 * pick the longest option, so a test controls every outcome with option lengths; two options of
 * the same length are a tie (the solvers disagree, the judge is unsure). The organizer keeps the
 * text; when polishing it fixes "teh"; it gives a question marked "may add" short wrong options.
 * Notes cite one live and one dead source; a stem with "old guideline" has an outdated key.
 */
interface Block {
  id: string;
  stem: string;
  options: { letter: string; text: string }[];
  mayAdd: boolean;
}

function blocksOf(prompt: string): Block[] {
  return prompt.split('\n\n').flatMap((part) => {
    const lines = part.split('\n');
    const head = /^\[(q\d+)\] (.*)$/.exec(lines[0] ?? '');
    if (!head) return [];
    const options = lines.slice(1).flatMap((line) => {
      const option = /^([A-J])\. (.*)$/.exec(line);
      return option ? [{ letter: option[1] ?? '', text: option[2] ?? '' }] : [];
    });
    return [{ id: head[1] ?? '', stem: head[2] ?? '', options, mayAdd: lines.includes('may add') }];
  });
}

function longest(block: Block) {
  const top = Math.max(0, ...block.options.map((option) => option.text.length));
  const best = block.options.filter((option) => option.text.length === top);
  return { letter: best[0]?.letter ?? null, unique: best.length === 1 };
}

function organized(block: Block, polish: boolean, most: number) {
  const fix = (text: string) => (polish ? text.replaceAll('teh', 'the') : text);
  const options: { from: string | null; printed: string | null; text: string }[] =
    block.options.map((option) => ({
      from: option.letter,
      printed: option.text,
      text: fix(option.text),
    }));
  // A scanned question prints its options in its text ("a) … b) …"): they are found, not written.
  if (options.length === 0)
    for (const text of block.stem.split(/\s[a-d]\)\s/).slice(1))
      options.push({ from: 'text', printed: text, text });
  if (block.mayAdd)
    for (const text of ['Wrong', 'Nope', 'False', 'Never'].slice(
      0,
      Math.max(0, most - options.length),
    ))
      options.push({ from: null, printed: null, text });
  return {
    id: block.id,
    organizedStem: block.stem,
    stem: fix(block.stem),
    options,
    printedRight: null,
  };
}

function note(block: Block, researched: boolean) {
  return {
    id: block.id,
    topic: `Topic: ${block.stem.slice(0, 30)}`,
    domain: 'Medicine',
    keyIdea: 'The idea.',
    whyAnswer: 'Because.',
    options: block.options.map((option) => ({ letter: option.letter, why: 'Why.' })),
    ifThen: [],
    pearls: ['Remember this.'],
    sources: [
      { title: 'A guideline', url: researched ? 'https://guidelines.test/live' : null },
      { title: 'A dead page', url: 'https://dead.test/gone' },
    ],
    questionIssue: null,
  };
}

type Reply = [string, (prompt: string, blocks: Block[]) => object];

/** Solving, judging and organizing. */
const QUESTION_REPLIES: Reply[] = [
  [
    'You are a careful examiner',
    (_, blocks) => ({
      answers: blocks.map((b) => ({ id: b.id, answer: longest(b).letter, why: 'longest' })),
    }),
  ],
  [
    'You are the senior examiner',
    (_, blocks) => ({
      verdicts: blocks.map((b) => {
        const pick = longest(b);
        return { id: b.id, answer: pick.letter, decisive: pick.unique, why: 'the longest option' };
      }),
    }),
  ],
  [
    'You organize exam questions',
    (prompt, blocks) => {
      const most = Number(/fewer than (\d) options/.exec(prompt)?.[1] ?? 0);
      const polish = prompt.includes('written clearly');
      return { questions: blocks.map((b) => organized(b, polish, most)) };
    },
  ],
];

/** Notes and the other additions. */
const ADDITION_REPLIES: Reply[] = [
  [
    'You write a study note',
    (prompt, blocks) => ({
      notes: blocks.map((b) => note(b, prompt.includes('Search the web'))),
    }),
  ],
  [
    'For each exam question with its keyed answer',
    (_, blocks) => ({
      notes: blocks.map((b) => {
        const outdated = b.stem.includes('old guideline');
        return { id: b.id, outdated, note: outdated ? 'Current guidance differs (2024).' : null };
      }),
    }),
  ],
  [
    'Place each exam question',
    (_, blocks) => ({
      places: blocks.map((b) => ({ id: b.id, chapter: null, topic: null, difficulty: 3 })),
    }),
  ],
  [
    'Each pair below',
    (prompt) => ({
      pairs: [...prompt.matchAll(/^\[(q\d+)\]$/gm)].map((m) => ({
        id: m[1],
        same: true,
        why: 'same',
      })),
    }),
  ],
  ['Some pages of an exam file', () => ({ links: [] })],
];

/** The reply to one of the AI's question prompts, or null when the prompt is not one. */
export function triageReply(prompt: string): string | null {
  const reply = [...QUESTION_REPLIES, ...ADDITION_REPLIES].find(([start]) =>
    prompt.startsWith(start),
  );
  return reply ? JSON.stringify(reply[1](prompt, blocksOf(prompt))) : null;
}
