import type { AiFailure, AiProvider } from '../../ai/index.js';
import { renderPng } from '../adapters/raster.js';
import {
  acceptedMark,
  MARK_SYSTEM_PROMPT,
  MarkSuggestion,
  markQuestionText,
} from '../domain/mark-suggestion.js';
import type { ExtractedQuestion } from './extract-questions.js';

export type MarkReply =
  | { ok: true; letter: string | null }
  | { ok: false; failure: Exclude<AiFailure, 'invalid_output'> };

/**
 * Asks the user's AI which option of one question is marked by hand on its page image. Output
 * is untrusted: only a confident, visible mark on a real option counts; an invalid reply is
 * simply no answer.
 */
export async function askMark(
  question: Pick<ExtractedQuestion, 'number' | 'stem' | 'options'>,
  provider: AiProvider,
  image: string,
): Promise<MarkReply> {
  const reply = await provider.generate({
    name: 'marked_option',
    system: MARK_SYSTEM_PROMPT,
    parts: [
      { type: 'image', mediaType: 'image/png', base64: image },
      { type: 'text', text: markQuestionText(question) },
    ],
    schema: MarkSuggestion,
  });
  if (!reply.ok) {
    const { failure } = reply;
    return failure === 'invalid_output' ? { ok: true, letter: null } : { ok: false, failure };
  }
  return {
    ok: true,
    letter: acceptedMark(
      reply.value,
      question.options.map((option) => option.letter),
    ),
  };
}

/** Page images rendered once per page for the AI step. */
export function pageImages(file: string) {
  const images = new Map<number, Promise<string>>();
  return (page: number) => {
    if (!images.has(page)) images.set(page, renderPng(file, page));
    return images.get(page) as Promise<string>;
  };
}

/**
 * The AI layer on top of the rules (M3.3): only questions the rules left undecided are sent,
 * one page image each, to the user's own provider. Accepted marks become `ai_suggested`
 * answers (a separate provenance, never a source key); anything else stays undecided.
 */
export async function suggestMarks(
  file: string,
  questions: readonly ExtractedQuestion[],
  provider: AiProvider,
): Promise<ExtractedQuestion[]> {
  const image = pageImages(file);
  const result: ExtractedQuestion[] = [];
  for (const question of questions) {
    if (question.answer !== null || question.options.length < 2) {
      result.push(question);
      continue;
    }
    const reply = await askMark(question, provider, await image(question.page));
    const letter = reply.ok ? reply.letter : null;
    result.push(letter ? { ...question, answer: letter, evidence: 'ai_suggested' } : question);
  }
  return result;
}
