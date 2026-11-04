import type { AiTarget } from '../../../../contracts/providers.js';
import { AiExplanation, type AiExplanationResponse } from '../../../../contracts/study.js';
import { AppError } from '../../../platform/errors/index.js';
import type { Actor } from '../../identity/index.js';
import type { Snapshot } from '../domain/grading.js';
import type { StudyDeps } from './deps.js';
import { ownedSession } from './sessions.js';

const SYSTEM = [
  'You help a medical student understand one exam question they have just answered.',
  'Explain why the keyed answer is right and why each other option is wrong or less fitting.',
  'Say how sure you are; when the question is ambiguous or sources disagree, say so in "caveats".',
  'Never give personal medical advice. You do not replace the book: do not claim the book says anything.',
].join(' ');

const promptOf = (s: Snapshot) =>
  [
    s.stem,
    ...s.options.map((o) => `${o.letter}. ${o.text}`),
    `Keyed answer: ${s.answers.join(', ')}`,
    s.explanation ? `The book's explanation: ${s.explanation}` : 'The book gives no explanation.',
  ].join('\n');

/**
 * The user's own AI explains after the answer (FR-08-005, FR-08-006, FR-12-005): a separate,
 * labelled text, never the book's explanation and never shown before answering (UAT-043).
 */
export async function explainWithAi(
  deps: StudyDeps,
  actor: Actor,
  ref: { sessionId: string; position: number },
  target: AiTarget,
): Promise<AiExplanationResponse> {
  const session = await ownedSession(deps, actor, ref.sessionId);
  const item = (await deps.sessions.itemsOf(actor.accountId, session.id))[ref.position];
  if (!item) throw new AppError('not_found');
  if (item.answered_at === null)
    throw new AppError('validation_failed', { position: 'not_answered' });
  const provider = await deps.ai.openOwned(actor.accountId, target);
  if (!provider) throw new AppError('validation_failed', { instanceId: 'invalid_value' });
  const reply = await provider.generate({
    name: 'explanation',
    system: SYSTEM,
    parts: [{ type: 'text', text: promptOf(item.snapshot as Snapshot) }],
    schema: AiExplanation,
  });
  if (!reply.ok) return { outcome: 'failed', failure: reply.failure };
  const generatedBy = [target.instanceId, target.model].filter(Boolean).join(' · ');
  return { outcome: 'explained', generatedBy, ...reply.value };
}
