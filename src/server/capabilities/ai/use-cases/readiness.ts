import type { ReadinessStatus } from '../../../../contracts/ai.js';
import type { Actor } from '../../identity/index.js';
import { isKnownHardFailure, type ProviderConnection } from '../domain/provider.js';
import {
  isConsistentQuestion,
  TRIAL_PAGE_TEXT,
  TRIAL_SYSTEM_PROMPT,
  TrialQuestion,
} from '../domain/trial.js';
import type { AiDeps } from './deps.js';
import { findOwnedProvider } from './providers.js';

/** A hard failure checked this recently is reported again without calling the provider. */
const HARD_FAILURE_COOLDOWN_MS = 30_000;

async function record(deps: AiDeps, connection: ProviderConnection, status: ReadinessStatus) {
  const now = deps.clock.now();
  const ref = { ownerId: connection.ownerId, id: connection.id };
  const changes = { readinessStatus: status, readinessCheckedAt: now, updatedAt: now };
  return (await deps.providers.update(ref, changes)) ?? connection;
}

function isFreshHardFailure(deps: AiDeps, connection: ProviderConnection): boolean {
  const checkedAt = connection.readinessCheckedAt;
  if (!checkedAt || !isKnownHardFailure(connection.readinessStatus)) return false;
  return deps.clock.now().getTime() - checkedAt.getTime() < HARD_FAILURE_COOLDOWN_MS;
}

/** FR-08-011: is the server reachable, the key valid and allowed, and the model present? */
export async function checkProvider(deps: AiDeps, actor: Actor, id: string) {
  const connection = await findOwnedProvider(deps, actor, id);
  if (isFreshHardFailure(deps, connection)) return { connection, fromCache: true };
  const status = await deps.openProvider(connection).checkReadiness();
  return { connection: await record(deps, connection, status), fromCache: false };
}

type TrialOutcome = 'ok' | 'invalid_output' | 'not_ready';

/**
 * Runs one tiny real task (read a sample question) through the full pipeline. A known hard
 * failure (bad key, no permission, no quota) is returned without spending another call.
 */
export async function runTrial(deps: AiDeps, actor: Actor, id: string) {
  let connection = await findOwnedProvider(deps, actor, id);
  const done = (outcome: TrialOutcome, question: TrialQuestion | null = null) => ({
    outcome,
    connection,
    question,
  });
  if (isKnownHardFailure(connection.readinessStatus)) return done('not_ready');
  const provider = deps.openProvider(connection);
  const status = await provider.checkReadiness();
  connection = await record(deps, connection, status);
  if (status !== 'ready') return done('not_ready');
  const result = await provider.generate({
    name: 'question',
    system: TRIAL_SYSTEM_PROMPT,
    parts: [{ type: 'text', text: TRIAL_PAGE_TEXT }],
    schema: TrialQuestion,
  });
  if (result.ok)
    return isConsistentQuestion(result.value) ? done('ok', result.value) : done('invalid_output');
  if (result.failure === 'invalid_output') return done('invalid_output');
  connection = await record(deps, connection, result.failure);
  return done('not_ready');
}
