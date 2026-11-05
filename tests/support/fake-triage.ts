/**
 * A deterministic stand-in for the triage models (DEC-33): a solver and the judge pick the
 * longest option, so a test controls every outcome with option lengths. Two options of the same
 * length are a tie: the solvers (one sees the options reversed) disagree, and the judge is unsure.
 * The improver fixes "teh", and gives questions with fewer than three options short distractors.
 */
interface Block {
  id: string;
  stem: string;
  options: { letter: string; text: string }[];
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
    return [{ id: head[1] ?? '', stem: head[2] ?? '', options }];
  });
}

function longest(block: Block) {
  const top = Math.max(0, ...block.options.map((option) => option.text.length));
  const best = block.options.filter((option) => option.text.length === top);
  return { letter: best[0]?.letter ?? null, unique: best.length === 1 };
}

function improved(block: Block) {
  const options: { from: string | null; text: string }[] = block.options.map((option) => ({
    from: option.letter,
    text: option.text.replaceAll('teh', 'the'),
  }));
  if (options.length > 0 && options.length < 3)
    for (const text of ['Wrong', 'Nope', 'False'].slice(0, 4 - options.length))
      options.push({ from: null, text });
  return { id: block.id, stem: block.stem.replaceAll('teh', 'the'), options, printedRight: null };
}

/** The reply to a triage prompt, or null when the prompt is not one. */
export function triageReply(prompt: string): string | null {
  const blocks = blocksOf(prompt);
  if (prompt.startsWith('You are a careful examiner'))
    return JSON.stringify({
      answers: blocks.map((b) => ({ id: b.id, answer: longest(b).letter, why: 'longest' })),
    });
  if (prompt.startsWith('You are the senior examiner'))
    return JSON.stringify({
      verdicts: blocks.map((b) => {
        const pick = longest(b);
        return { id: b.id, answer: pick.letter, decisive: pick.unique, why: 'the longest option' };
      }),
    });
  if (prompt.startsWith('You edit exam questions'))
    return JSON.stringify({ questions: blocks.map(improved) });
  return null;
}
