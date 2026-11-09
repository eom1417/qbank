import { randomInt } from 'node:crypto';
import type { SharePolicy } from '../../../../contracts/sharing.js';
import type {
  PublicPolicy,
  StartAttemptResponse,
  TakeLandingResponse,
} from '../../../../contracts/take.js';
import { AppError, notFound } from '../../../platform/errors/index.js';
import { deadlineFor } from '../../exam-rules/index.js';
import type { ChannelRow } from '../adapters/channel-repository.js';
import { hashOf, newSecret, secretOf } from '../adapters/keys.js';
import { codeMatches, personKeyOf } from '../domain/attempt.js';
import { attemptSize, drawQuestions, snapshotOf } from '../domain/attempt-draw.js';
import type { ChannelsDeps } from './deps.js';
import { enforce, shareStatus } from './governance.js';
import { readyQuestions } from './manage.js';

/** Unpredictable draws and orders: people must not guess the next attempt's questions. */
const RANGE = 2 ** 47;
const cryptoRandom = () => randomInt(RANGE) / RANGE;

/** The exam/practice share a link token opens; an agent's key or anything else opens none. */
export async function shareOfLink(deps: ChannelsDeps, token: string) {
  const secret = deps.linksEnabled ? secretOf(token, 'qbt_') : null;
  const row = secret ? await deps.channels.findByKeyHash(hashOf(secret)) : undefined;
  if (!row || row.kind === 'agent') throw notFound();
  return row;
}

/** The policy as receivers see it: whether a code is asked, never the code. */
const publicPolicy = (policy: SharePolicy): PublicPolicy => {
  const { audience } = policy;
  return {
    ...policy,
    audience: {
      access: audience.access === 'code' ? 'code' : 'open',
      askId: audience.access !== 'key' && audience.askId,
    },
  };
};

/** The landing page: the share's rules and status before anyone starts. */
export function landing(deps: ChannelsDeps, row: ChannelRow): TakeLandingResponse {
  const share = enforce(deps, row, 'view');
  return {
    kind: row.kind === 'exam' ? 'exam' : 'practice',
    name: row.name,
    policy: publicPolicy(share.policy),
    status: shareStatus(row, deps.clock.now()),
    total: attemptSize(share.policy.content),
  };
}

interface Person {
  name: string;
  personId?: string | undefined;
  code?: string | undefined;
}

/** The person gave what the share asks: their id when asked, and the right code when set. */
function checkPerson(policy: SharePolicy, person: Person) {
  const { audience } = policy;
  if (audience.access !== 'key' && audience.askId && !person.personId)
    throw new AppError('validation_failed', { personId: 'required' });
  if (audience.access === 'code' && !codeMatches(person.code, audience.code))
    throw new AppError('wrong_code');
}

/**
 * Starts one person's attempt (DEC-39): the gate with their attempts so far, a fresh draw from
 * the ready questions kept as snapshots, the exam's clock from now. The token is in this answer
 * only; the share keeps its hash.
 */
export async function startAttempt(
  deps: ChannelsDeps,
  row: ChannelRow,
  person: Person,
): Promise<StartAttemptResponse> {
  const { policy } = enforce(deps, row, 'view');
  checkPerson(policy, person);
  const personKey = personKeyOf(row.id, person.name, person.personId);
  const pool = await readyQuestions(deps, row);
  const named = policy.records.identify === 'named';
  const { secret, hash } = newSecret('qba_');
  const id = deps.newId();
  const now = deps.clock.now();
  const items = await deps.attempts.forPerson(row.id, async (tx) => {
    enforce(deps, row, 'open', { attemptsUsed: await tx.countOfPerson(row.id, personKey) });
    const drawn = drawQuestions(pool, policy.content, cryptoRandom);
    if (!drawn) throw new AppError('not_enough_questions');
    await tx.insert({
      id,
      channelId: row.id,
      ownerId: row.owner_id,
      version: row.version,
      personName: named ? person.name : null,
      personRef: named ? (person.personId ?? null) : null,
      personKey,
      tokenHash: hash,
      startedAt: now,
      deadlineAt:
        row.kind === 'exam' ? deadlineFor('total', policy.limits.durationSeconds, now) : null,
      items: drawn.map((q) => ({ questionId: q.id, snapshot: snapshotOf(q) })),
    });
    return drawn.length;
  });
  await deps.channels.touch(row.id, now);
  await deps.ledger.record({
    channelId: row.id,
    ownerId: row.owner_id,
    type: 'attempt_started',
    version: row.version,
    detail: { attemptId: id, total: items },
  });
  return { attemptId: id, token: secret };
}
