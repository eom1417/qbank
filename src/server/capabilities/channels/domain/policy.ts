import type {
  RevealLevel,
  ShareKind,
  SharePolicy,
  ShareStatus,
} from '../../../../contracts/sharing.js';

/**
 * The one gate of governed sharing (M30, DEC-39). Every transport (the agent API, its MCP
 * tools, the exam/practice link) asks it before anything leaves the bank; none decides alone.
 * Pure: the caller passes the share, the moment and the counts, and turns a refusal into the
 * error it names.
 */

/** What the gate needs to know about a share. */
export interface ShareState {
  kind: ShareKind;
  policy: SharePolicy;
  paused: boolean;
  endedAt: Date | null;
  archivedAt: Date | null;
}

/** The share's status now: archived, then ended, then paused, then not yet started. */
export function statusOf(share: ShareState, now: Date): ShareStatus {
  if (share.archivedAt) return 'archived';
  const ends = share.policy.limits.endsAt;
  if (share.endedAt || (ends !== null && now.getTime() >= Date.parse(ends))) return 'ended';
  if (share.paused) return 'paused';
  const starts = share.policy.limits.startsAt;
  if (starts !== null && now.getTime() < Date.parse(starts)) return 'scheduled';
  return 'active';
}

/**
 * - `open`: something new leaves (an agent's new batch, a person's new attempt);
 * - `continue`: work already under way (answering, flagging, an agent recording an answer);
 * - `submit`: handing in an attempt, which stays possible after a pause or the end;
 * - `view`: reading what was already given (a batch again, a landing page, a result).
 */
export type GateAction = 'open' | 'continue' | 'submit' | 'view';

/** Counts the caller has for limits: batches sent today (UTC), the person's attempts so far. */
export interface GateUsage {
  batchesToday?: number;
  attemptsUsed?: number;
}

type DenyCode =
  | 'not_found'
  | 'share_ended'
  | 'channel_paused'
  | 'share_not_started'
  | 'share_limit_reached'
  | 'attempts_used';

export type Decision = { ok: true } | { ok: false; code: DenyCode };

const ALLOW: Decision = { ok: true };
const deny = (code: DenyCode): Decision => ({ ok: false, code });

/** What each status refuses, before any limit is counted. */
const REFUSAL: Record<ShareStatus, DenyCode | null> = {
  archived: 'not_found',
  ended: 'share_ended',
  paused: 'channel_paused',
  scheduled: 'share_not_started',
  active: null,
};

function statusDecision(status: ShareStatus, action: GateAction): Decision {
  if (status === 'archived') return deny('not_found');
  if (action === 'view' || action === 'submit') return ALLOW;
  const refusal = REFUSAL[status];
  return refusal ? deny(refusal) : ALLOW;
}

function limitDecision(policy: SharePolicy, usage: GateUsage): Decision {
  const { batchesPerDay, attemptsPerPerson } = policy.limits;
  if (batchesPerDay !== null && (usage.batchesToday ?? 0) >= batchesPerDay)
    return deny('share_limit_reached');
  if (attemptsPerPerson !== null && (usage.attemptsUsed ?? 0) >= attemptsPerPerson)
    return deny('attempts_used');
  return ALLOW;
}

/** Whether the share allows this now. Limits count only when something new opens. */
export function gate(
  share: ShareState,
  action: GateAction,
  now: Date,
  usage: GateUsage = {},
): Decision {
  const byStatus = statusDecision(statusOf(share, now), action);
  if (!byStatus.ok || action !== 'open') return byStatus;
  return limitDecision(share.policy, usage);
}

const LEVELS: readonly RevealLevel[] = ['none', 'score', 'answers', 'explained'];

/** Whether a revealed level includes another (`explained` includes the answers and the score). */
export const reveals = (level: RevealLevel, wanted: RevealLevel) =>
  LEVELS.indexOf(level) >= LEVELS.indexOf(wanted);

/** When the share ends: ended early by its owner, or at its planned end; null if open-ended. */
function endOf(share: Pick<ShareState, 'policy' | 'endedAt'>): number | null {
  const planned =
    share.policy.limits.endsAt === null ? null : Date.parse(share.policy.limits.endsAt);
  const early = share.endedAt?.getTime() ?? null;
  if (planned === null) return early;
  return early === null ? planned : Math.min(planned, early);
}

/** The moment the policy's level is shown, for something finished (or sent) at `finishedAt`. */
function revealAt(share: Pick<ShareState, 'policy' | 'endedAt'>, finishedAt: Date): Date | null {
  const { when, hours } = share.policy.reveal;
  if (when === 'immediately') return finishedAt;
  if (when === 'after_hours') return new Date(finishedAt.getTime() + (hours ?? 0) * 3_600_000);
  const ends = endOf(share);
  return ends === null ? null : new Date(Math.max(ends, finishedAt.getTime()));
}

/**
 * What may be shown now about something finished at `finishedAt` (a submitted attempt, a sent
 * batch): the policy's level once its time has come, nothing before; `moreAt` says when. A share
 * its owner ended early reveals `after_end` from that moment.
 */
export function revealNow(
  share: Pick<ShareState, 'policy' | 'endedAt'>,
  finishedAt: Date,
  now: Date,
) {
  const { policy } = share;
  const at = revealAt(share, finishedAt);
  const due = at !== null && now.getTime() >= at.getTime();
  return {
    level: due ? policy.reveal.level : ('none' as RevealLevel),
    moreAt: due || policy.reveal.level === 'none' ? null : at,
  };
}

/** Practice shows each answer right after it is given, when its policy reveals at once. */
export const feedbackEachQuestion = (share: Pick<ShareState, 'kind' | 'policy'>) =>
  share.kind === 'practice' &&
  share.policy.reveal.when === 'immediately' &&
  reveals(share.policy.reveal.level, 'answers');
