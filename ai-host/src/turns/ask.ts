import type { ChatImageAttachment } from '@t3tools/contracts';
import type {
  ProviderAdapterV2Event,
  ProviderAdapterV2SessionRuntime,
} from '@t3tools/provider-core/server/ProviderAdapter';
import * as Data from 'effect/Data';
import * as Deferred from 'effect/Deferred';
import * as Effect from 'effect/Effect';
import * as Ref from 'effect/Ref';
import * as Stream from 'effect/Stream';

import { ProviderAdapterRegistryV2 } from '../../../vendor/t3-ai-providers-kit/kit/apps/server/src/orchestration-v2/ProviderAdapterRegistry.ts';
import { storeImage } from './attachment.ts';
import { mintTurnIdentity, type AskTarget } from './identity.ts';
import { toolGate } from './research.ts';

/** Why a question got no answer; `usage_limit` and friends come from the provider itself. */
export class AskFailed extends Data.TaggedError('AskFailed')<{
  readonly reason: string;
  readonly detail: string;
}> {}

export interface AskInput extends AskTarget {
  readonly prompt: string;
  readonly image?: Uint8Array | undefined;
  readonly timeoutMs: number;
  /** May search and read the web for its sources (`toolGate`); every other tool is declined. */
  readonly research?: boolean | undefined;
}

type Outcome =
  { readonly ok: true } | { readonly ok: false; readonly reason: string; readonly detail: string };

/** Keeps the assistant's latest text and settles the outcome when the turn ends. */
const follow = Effect.fn('follow')(function* (
  event: ProviderAdapterV2Event,
  reply: Ref.Ref<string>,
  done: Deferred.Deferred<Outcome>,
) {
  if (event.type === 'message.updated' && event.message.role === 'assistant')
    return yield* Ref.set(reply, event.message.text);
  if (event.type !== 'turn.terminal') return;
  if (event.status === 'completed') return yield* Deferred.succeed(done, { ok: true });
  // A failure says what kind it is (usage_limit, permission_error…) and why.
  const outcome: Outcome =
    event.status === 'failed'
      ? { ok: false, reason: event.failure.class, detail: event.failure.message }
      : { ok: false, reason: event.status, detail: event.reason ?? event.status };
  yield* Deferred.succeed(done, outcome);
});

/**
 * Answers every tool or permission request (QBank's questions never act: only a research turn's
 * web search is approved, `toolGate`), and follows the rest.
 */
const listen = Effect.fn('listen')(function* (
  session: ProviderAdapterV2SessionRuntime,
  turn: { reply: Ref.Ref<string>; done: Deferred.Deferred<Outcome>; research: boolean },
) {
  const gate = toolGate(turn.research);
  yield* session.events.pipe(
    Stream.runForEach((event) => {
      gate.see(event);
      if (event.type !== 'runtime_request.updated') return follow(event, turn.reply, turn.done);
      const decision = gate.decide(event.runtimeRequest.nodeId);
      return session
        .respondToRuntimeRequest({ requestId: event.runtimeRequest.id, decision })
        .pipe(Effect.ignore);
    }),
    Effect.ignore,
    Effect.forkScoped,
  );
});

const TIMED_OUT: Outcome = {
  ok: false,
  reason: 'timeout',
  detail: 'The provider did not answer in time.',
};

/**
 * One question through the instance's own adapter (INTEGRATION_GUIDE §7.2): a private,
 * read-only session and thread, the prompt with its page image, every tool request declined
 * (but a research turn's web search),
 * and the assistant's text when the turn ends. QBank checks the text itself.
 */
export const askOnce = Effect.fn('askOnce')(function* (input: AskInput) {
  const turn = yield* mintTurnIdentity(input);
  const adapter = yield* (yield* ProviderAdapterRegistryV2).get(turn.modelSelection.instanceId);
  const attachments: ChatImageAttachment[] = input.image
    ? [yield* storeImage(turn.threadId, input.image)]
    : [];
  const { modelSelection, runtimePolicy, threadId } = turn;
  const session = yield* adapter.openSession({
    threadId,
    providerSessionId: turn.providerSessionId,
    modelSelection,
    runtimePolicy,
  });
  const reply = yield* Ref.make('');
  const done = yield* Deferred.make<Outcome>();
  yield* listen(session, { reply, done, research: input.research === true });
  const providerThread = yield* session.ensureThread({ threadId, modelSelection, runtimePolicy });
  yield* session.startTurn({
    ...{
      appThread: turn.appThread,
      threadId,
      runId: turn.runId,
      attemptId: turn.attemptId,
      rootNodeId: turn.rootNodeId,
    },
    runOrdinal: 1,
    providerTurnOrdinal: 1,
    providerThread,
    message: {
      messageId: turn.messageId,
      text: input.prompt,
      attachments,
      createdBy: 'user',
      creationSource: 'server',
    },
    modelSelection,
    runtimePolicy,
  });
  const outcome = yield* Deferred.await(done).pipe(
    Effect.timeoutOrElse({ duration: input.timeoutMs, orElse: () => Effect.succeed(TIMED_OUT) }),
  );
  if (!outcome.ok) return yield* new AskFailed({ reason: outcome.reason, detail: outcome.detail });
  return { text: yield* Ref.get(reply) };
}, Effect.scoped);
