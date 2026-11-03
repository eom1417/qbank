import {
  MessageId,
  ModelSelection,
  NodeId,
  OrchestrationV2AppThread,
  ProjectId,
  ProviderSessionId,
  RunAttemptId,
  RunId,
  ThreadId,
} from '@t3tools/contracts';
import { randomUuidV4 } from '@t3tools/provider-core/server/randomUuid';
import * as DateTime from 'effect/DateTime';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';

/** One question to one provider instance; QBank keeps no conversation. */
export interface AskTarget {
  readonly instanceId: string;
  /** The model's slug; the instance's default when omitted ("default" is a sentinel). */
  readonly model?: string | undefined;
  readonly cwd: string;
}

/**
 * The orchestration identities a turn needs (INTEGRATION_GUIDE §7.2), minted by the host: a
 * private, read-only app thread per question, its run, attempt, root node and message.
 */
export const mintTurnIdentity = Effect.fn('mintTurnIdentity')(function* (target: AskTarget) {
  const threadId = ThreadId.make(yield* randomUuidV4);
  const modelSelection = yield* Schema.decodeEffect(ModelSelection)({
    instanceId: target.instanceId,
    model: target.model ?? 'default',
  });
  const now = yield* DateTime.now;
  const appThread = yield* Schema.decodeEffect(OrchestrationV2AppThread)({
    createdBy: 'system',
    creationSource: 'server',
    id: threadId,
    projectId: ProjectId.make('qbank'),
    title: 'QBank question',
    providerInstanceId: target.instanceId,
    modelSelection: { instanceId: target.instanceId, model: modelSelection.model },
    runtimeMode: 'approval-required',
    interactionMode: 'default',
    branch: null,
    worktreePath: null,
    activeProviderThreadId: null,
    lineage: { parentThreadId: null, relationshipToParent: null, rootThreadId: threadId },
    forkedFrom: null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    deletedAt: null,
  });
  return {
    threadId,
    appThread,
    modelSelection,
    providerSessionId: ProviderSessionId.make(yield* randomUuidV4),
    runId: RunId.make(yield* randomUuidV4),
    attemptId: RunAttemptId.make(yield* randomUuidV4),
    rootNodeId: NodeId.make(yield* randomUuidV4),
    messageId: MessageId.make(yield* randomUuidV4),
    // Read-only: anything the agent asks to do needs approval, and QBank declines it.
    runtimePolicy: {
      runtimeMode: 'approval-required',
      interactionMode: 'default',
      cwd: target.cwd,
    } as const,
  };
});

export type TurnIdentity = Effect.Success<ReturnType<typeof mintTurnIdentity>>;
