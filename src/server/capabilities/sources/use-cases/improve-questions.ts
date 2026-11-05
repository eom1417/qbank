import type { AiFailure, AiProvider } from '../../providers/index.js';
import { mapWithLimit } from '../../../platform/concurrency.js';
import { askBatch } from './ask-batch.js';
import { batches } from '../domain/triage/batch.js';
import {
  IMPROVE_PROMPT,
  ImproveReply,
  acceptedImprovement,
  improveText,
  type ToImprove,
} from '../domain/triage/improve.js';
import { reshape, type Reshaped } from '../domain/triage/reshape.js';

const PARALLEL = 3;

export interface ImproveResult {
  /** Accepted improvements by question id; a rejected or missing one is left out. */
  byId: Map<string, Reshaped>;
  failure: AiFailure | null;
}

/** Improvement mode (DEC-04): every question in batches, each reply checked before it is used. */
export async function improveQuestions(
  provider: AiProvider,
  items: readonly ToImprove[],
): Promise<ImproveResult> {
  const replies = await mapWithLimit(batches(items), PARALLEL, async (batch) => {
    const reply = await askBatch(provider, {
      name: 'improve_questions',
      system: IMPROVE_PROMPT,
      parts: [{ type: 'text', text: improveText(batch) }],
      schema: ImproveReply,
    });
    if (!reply.ok) return { failure: reply.failure, improved: [] as [string, Reshaped][] };
    const byId = new Map(reply.value.questions.map((question) => [question.id, question]));
    const improved = batch.flatMap(({ question }): [string, Reshaped][] => {
      const answer = byId.get(question.id);
      const accepted = answer ? acceptedImprovement(question, answer) : null;
      return accepted ? [[question.id, reshape(accepted)]] : [];
    });
    return { failure: null, improved };
  });
  return {
    byId: new Map(replies.flatMap((reply) => reply.improved)),
    failure: replies.find((reply) => reply.failure)?.failure ?? null,
  };
}
