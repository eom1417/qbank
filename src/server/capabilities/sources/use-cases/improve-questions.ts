import type { AiFailure, AiProvider } from '../../providers/index.js';
import { mapWithLimit } from '../../../platform/concurrency.js';
import { askInParts } from './ask-batch.js';
import { batches } from '../domain/triage/batch.js';
import {
  ImproveReply,
  acceptedImprovement,
  improvePrompt,
  improveText,
  type ImproveRules,
  type ToImprove,
} from '../domain/triage/improve.js';
import { reshape, type Reshaped } from '../domain/triage/reshape.js';

const PARALLEL = 3;

export interface ImproveResult {
  /** Accepted improvements by question id; a rejected or missing one is left out. */
  byId: Map<string, Reshaped>;
  failure: AiFailure | null;
}

/** The part's accepted improvements, each checked before it is used. */
function acceptedOf(part: readonly ToImprove[], reply: ImproveReply, rules: ImproveRules) {
  const byId = new Map(reply.questions.map((question) => [question.id, question]));
  return part.flatMap((item): [string, Reshaped][] => {
    const answer = byId.get(item.question.id);
    const accepted = answer ? acceptedImprovement(item, answer, rules) : null;
    return accepted ? [[item.question.id, reshape(accepted)]] : [];
  });
}

/**
 * Organizing (always, with AI) and the chosen text improvements (DEC-34): every question in
 * batches, each reply checked before it is used.
 */
export async function improveQuestions(
  provider: AiProvider,
  items: readonly ToImprove[],
  rules: ImproveRules,
): Promise<ImproveResult> {
  const replies = await mapWithLimit(batches(items), PARALLEL, async (batch) => {
    const parts = await askInParts(provider, batch, (part) => ({
      name: 'improve_questions',
      system: improvePrompt(rules),
      parts: [{ type: 'text', text: improveText(part) }],
      schema: ImproveReply,
    }));
    return parts.map(({ part, reply }) =>
      reply === null || reply.ok
        ? { failure: null, improved: reply ? acceptedOf(part, reply.value, rules) : [] }
        : { failure: reply.failure, improved: [] as [string, Reshaped][] },
    );
  });
  const all = replies.flat();
  return {
    byId: new Map(all.flatMap((reply) => reply.improved)),
    failure: all.find((reply) => reply.failure)?.failure ?? null,
  };
}
