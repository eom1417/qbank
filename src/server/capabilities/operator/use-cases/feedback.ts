import type { FeedbackItem, FeedbackRequest } from '../../../../contracts/operator.js';
import { AppError, notFound } from '../../../platform/errors/index.js';
import type { Actor } from '../../identity/index.js';
import { feedbackWindowStart, maySendFeedback } from '../domain/feedback-limit.js';
import type { OperatorDeps } from './deps.js';

/** The notes the console shows at once, newest first. */
const LIST_LIMIT = 200;

/** Saves a user's note for the operator, with the running version (M31, B1). */
export async function sendFeedback(deps: OperatorDeps, actor: Actor, input: FeedbackRequest) {
  const now = deps.clock.now();
  const sent = await deps.feedback.countSince(actor.accountId, feedbackWindowStart(now));
  if (!maySendFeedback(sent)) throw new AppError('too_many_attempts');
  await deps.feedback.insert({
    id: deps.newId(),
    ownerId: actor.accountId,
    message: input.message,
    screen: input.screen,
    version: deps.version,
    createdAt: now,
  });
}

/** The notes with who sent them: e-mail and name, nothing else of the account. */
export async function listFeedback(deps: OperatorDeps): Promise<FeedbackItem[]> {
  const notes = await deps.feedback.list(LIST_LIMIT);
  const contacts = await deps.contactsOf([...new Set(notes.map((note) => note.ownerId))]);
  return notes.map((note) => ({
    id: note.id,
    accountEmail: contacts.get(note.ownerId)?.email ?? '',
    accountName: contacts.get(note.ownerId)?.displayName ?? '',
    message: note.message,
    screen: note.screen,
    version: note.version,
    createdAt: note.createdAt.toISOString(),
    closedAt: note.closedAt?.toISOString() ?? null,
  }));
}

export async function closeFeedback(deps: OperatorDeps, id: string) {
  if (!(await deps.feedback.close(id, deps.clock.now()))) throw notFound();
}
