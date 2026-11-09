import type { z } from 'zod';
import type { ExposureRequest, ExposureResponse } from '../../../../contracts/sharing.js';
import type { Actor } from '../../identity/index.js';
import type { ChannelsDeps } from './deps.js';
import { ownedBank } from './manage.js';
import { inScope, isReserved, reservedScopes } from './shares-scope.js';

/**
 * Before publishing (DEC-39): of the ready questions in this scope, how many have already left
 * the bank through another share, and how many an exam share reserves.
 */
export async function exposure(
  deps: ChannelsDeps,
  actor: Actor,
  bankId: string,
  scope: z.infer<typeof ExposureRequest>,
): Promise<ExposureResponse> {
  await ownedBank(deps, actor, bankId);
  const pool = await deps.questions.studyPool(actor.accountId, { bankIds: [bankId] });
  const inside = pool.filter((question) => inScope(scope, question));
  const [exposed, scopes] = await Promise.all([
    deps.ledger.exposedAmong(
      actor.accountId,
      inside.map((question) => question.id),
    ),
    reservedScopes(deps, actor.accountId, bankId),
  ]);
  return {
    inScope: inside.length,
    exposed: exposed.size,
    reserved: inside.filter((question) => isReserved(scopes, question)).length,
  };
}
