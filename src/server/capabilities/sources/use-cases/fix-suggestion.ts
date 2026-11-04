import type { AiTarget } from '../../../../contracts/providers.js';
import type { FixSuggestionResponse } from '../../../../contracts/review.js';
import { AppError, notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { Actor } from '../../identity/index.js';
import { pageLines } from '../domain/lines.js';
import type { PageText } from '../domain/page.js';
import { FIX_SYSTEM_PROMPT, FixSuggestion, refusalOf } from '../domain/fix-suggestion.js';
import type { SourcesDeps } from './deps.js';

/** The page's words in reading order, the only source an AI fix may cite. */
async function pageTextOf(deps: SourcesDeps, ownerId: string, sourceId: string, page: number) {
  const row = await deps.imports.pageOfSource(ownerId, sourceId, page);
  if (!row) return null;
  return pageLines(row.content as PageText, null)
    .map((line) => line.text)
    .join('\n');
}

function questionText(stem: string, options: readonly { letter: string; text: string }[]) {
  return [stem, ...options.map((o) => `${o.letter}. ${o.text}`)].join('\n');
}

/**
 * Asks the user's AI to fix reading errors in one question (FR-09-005, FR-08-004). Nothing is
 * saved: the owner compares it with the current text and may apply it as an edit. A suggestion
 * that pads the text, changes the options or cites words not on the page is refused.
 */
export async function suggestFix(
  deps: SourcesDeps,
  actor: Actor,
  questionId: string,
  target: AiTarget,
): Promise<FixSuggestionResponse> {
  const question = isId(questionId)
    ? await deps.questions.findQuestion(actor.accountId, questionId)
    : undefined;
  if (!question) throw notFound();
  const provider = await deps.ai.openOwned(actor.accountId, target);
  if (!provider) throw new AppError('validation_failed', { instanceId: 'invalid_value' });
  const page = await pageTextOf(deps, actor.accountId, question.source_id, question.source_page);
  if (page === null) return { outcome: 'refused', why: 'no_page_text' };
  const options = question.options as { letter: string; text: string }[];
  const reply = await provider.generate({
    name: 'question_fix',
    system: FIX_SYSTEM_PROMPT,
    parts: [
      {
        type: 'text',
        text: `Page text:\n${page}\n\nQuestion as read:\n${questionText(question.stem, options)}`,
      },
    ],
    schema: FixSuggestion,
  });
  if (!reply.ok) return { outcome: 'failed', failure: reply.failure };
  const why = refusalOf({ stem: question.stem, options }, reply.value, page);
  return why ? { outcome: 'refused', why } : { outcome: 'suggested', ...reply.value };
}
