import type { AiProvider } from '../../ai/index.js';
import { renderPng } from '../adapters/raster.js';
import {
  acceptedMark,
  MARK_SYSTEM_PROMPT,
  MarkSuggestion,
  markQuestionText,
} from '../domain/mark-suggestion.js';
import type { ExtractedQuestion } from './extract-questions.js';

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
  const images = new Map<number, Promise<string>>();
  const pageImage = (page: number) => {
    if (!images.has(page)) images.set(page, renderPng(file, page));
    return images.get(page) as Promise<string>;
  };
  const result: ExtractedQuestion[] = [];
  for (const question of questions) {
    if (question.answer !== null || question.options.length < 2) {
      result.push(question);
      continue;
    }
    const reply = await provider.generate({
      name: 'marked_option',
      system: MARK_SYSTEM_PROMPT,
      parts: [
        { type: 'image', mediaType: 'image/png', base64: await pageImage(question.page) },
        { type: 'text', text: markQuestionText(question) },
      ],
      schema: MarkSuggestion,
    });
    const letters = question.options.map((option) => option.letter);
    const letter = reply.ok ? acceptedMark(reply.value, letters) : null;
    result.push(letter ? { ...question, answer: letter, evidence: 'ai_suggested' } : question);
  }
  return result;
}
