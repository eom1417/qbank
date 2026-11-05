import { z } from 'zod';

/** One single-answer question as the triage models see it: its text only, never its key. */
export interface TriageQuestion {
  /** The question's place in its batch ("q1", "q2"…), echoed back by the model. */
  id: string;
  stem: string;
  options: readonly { letter: string; text: string }[];
}

/** Fields every triage reply item has: the question's id and a letter, or none. */
export const replyItem = {
  id: z.string().trim().min(1).max(20),
  answer: z.string().trim().max(2).nullable(),
};

/** Questions per model request: enough to save requests, few enough to keep answers careful. */
const BATCH_SIZE = 8;

export function batches<T>(items: readonly T[], size = BATCH_SIZE): T[][] {
  const out: T[][] = [];
  for (let start = 0; start < items.length; start += size)
    out.push(items.slice(start, start + size));
  return out;
}

/** A question and its options as plain text, for any triage prompt. */
export function questionBlock(question: TriageQuestion): string {
  const options = question.options.map((option) => `${option.letter}. ${option.text}`);
  return [`[${question.id}] ${question.stem}`, ...options].join('\n');
}

/** The model's letter, only when it names one of the question's real options. */
export function realLetter(question: TriageQuestion, letter: string | null): string | null {
  if (letter === null) return null;
  const upper = letter.trim().toUpperCase();
  return question.options.some((option) => option.letter === upper) ? upper : null;
}

/**
 * The same question with its options in reverse order and lettered again, so a second solver
 * does not share the first one's position bias; `back` maps a new letter to the original one.
 */
export function reversed(question: TriageQuestion) {
  const back = new Map<string, string>();
  const options = [...question.options].reverse().map((option, index) => {
    const letter = String.fromCharCode(65 + index);
    back.set(letter, option.letter);
    return { letter, text: option.text };
  });
  return { question: { ...question, options }, back };
}
