import type { RevealLevel, ShareKind, SharePolicy } from '../../../contracts/sharing.js';
import type { PublicPolicy } from '../../../contracts/take.js';
import type { MessageKey } from '../../platform/i18n/i18n.js';

/** The owner's policy, or the same policy as receivers get it (never the access code). */
export type AnyPolicy = SharePolicy | PublicPolicy;

/** What the sentences need from the screen: the strings, and dates in the reader's language. */
export interface Speaker {
  t(key: MessageKey): string;
  date(iso: string): string;
}

export type PolicyLineId = 'what' | 'who' | 'when' | 'reveal' | 'records';
export interface PolicyLine {
  id: PolicyLineId;
  text: string;
}

/** Puts `{name}` values into a translated template; an unknown name stays as written. */
export const fill = (template: string, vars: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );

const SEP = ' · ';
const DAYS_IN_YEAR = 365;

function scopeText(policy: AnyPolicy, s: Speaker, chapterNames?: readonly string[]): string {
  if (chapterNames && chapterNames.length > 0)
    return fill(s.t('sharing.card.scope.named'), {
      names: chapterNames.join(s.t('sharing.card.listJoin')),
    });
  const count = policy.content.chapterIds.length;
  if (count > 0) return fill(s.t('sharing.card.scope.count'), { n: count });
  return s.t('sharing.card.scope.all');
}

function whatLine(kind: ShareKind, policy: AnyPolicy, s: Speaker, names?: readonly string[]) {
  const { size, fixedQuestionIds, reserve, passPercent, whenDone } = policy.content;
  const scope = scopeText(policy, s, names);
  if (kind === 'agent')
    return [
      fill(s.t('sharing.card.what.agent'), { size, scope }),
      s.t(whenDone === 'stop' ? 'sharing.card.whenDone.stop' : 'sharing.card.whenDone.restart'),
    ].join(SEP);
  const parts = [fill(s.t('sharing.card.what.attempt'), { size, scope })];
  if (fixedQuestionIds.length > 0)
    parts.push(fill(s.t('sharing.card.fixed'), { n: fixedQuestionIds.length }));
  if (kind === 'exam' && reserve) parts.push(s.t('sharing.card.reserved'));
  if (passPercent !== null) parts.push(fill(s.t('sharing.card.pass'), { n: passPercent }));
  return parts.join(SEP);
}

function whoLine(policy: AnyPolicy, s: Speaker): string {
  const { audience } = policy;
  if (audience.access === 'key') return s.t('sharing.card.who.key');
  const who = s.t(audience.access === 'code' ? 'sharing.card.who.code' : 'sharing.card.who.open');
  const asks = s.t(audience.askId ? 'sharing.card.asks.nameId' : 'sharing.card.asks.name');
  return [who, asks].join(SEP);
}

function windowText(policy: AnyPolicy, s: Speaker): string {
  const { startsAt, endsAt } = policy.limits;
  if (startsAt && endsAt)
    return fill(s.t('sharing.card.window.both'), { start: s.date(startsAt), end: s.date(endsAt) });
  if (startsAt) return fill(s.t('sharing.card.window.from'), { start: s.date(startsAt) });
  if (endsAt) return fill(s.t('sharing.card.window.until'), { end: s.date(endsAt) });
  return s.t('sharing.card.window.open');
}

function attemptsText(attempts: number | null, s: Speaker): string {
  if (attempts === null) return s.t('sharing.card.attempts.unlimited');
  if (attempts === 1) return s.t('sharing.card.attempts.one');
  return fill(s.t('sharing.card.attempts.many'), { n: attempts });
}

function peopleLimits(kind: ShareKind, policy: AnyPolicy, s: Speaker): string[] {
  const { attemptsPerPerson, durationSeconds, navigation } = policy.limits;
  const parts = [attemptsText(attemptsPerPerson, s)];
  if (durationSeconds !== null)
    parts.push(fill(s.t('sharing.card.duration'), { n: Math.round(durationSeconds / 60) }));
  else if (kind === 'exam') parts.push(s.t('sharing.card.duration.none'));
  if (navigation === 'forward') parts.push(s.t('sharing.card.forward'));
  return parts;
}

function whenLine(kind: ShareKind, policy: AnyPolicy, s: Speaker): string {
  const { batchesPerDay } = policy.limits;
  const parts = [windowText(policy, s)];
  if (kind !== 'agent') parts.push(...peopleLimits(kind, policy, s));
  else if (batchesPerDay === null) parts.push(s.t('sharing.card.batches.unlimited'));
  else parts.push(fill(s.t('sharing.card.batches'), { n: batchesPerDay }));
  return parts.join(SEP);
}

const IMMEDIATE: Record<ShareKind, MessageKey> = {
  agent: 'sharing.card.when.agent',
  exam: 'sharing.card.when.exam',
  practice: 'sharing.card.when.practice',
};

/** What a reveal level means for this kind: an agent gets answers, never a score. */
export function levelKey(kind: ShareKind, level: RevealLevel): MessageKey {
  if (kind === 'agent' && (level === 'answers' || level === 'explained'))
    return `sharing.card.level.agent.${level}`;
  return `sharing.card.level.${level}`;
}

function revealLine(kind: ShareKind, policy: AnyPolicy, s: Speaker): string {
  const { level, when, hours } = policy.reveal;
  const moment =
    when === 'immediately'
      ? s.t(IMMEDIATE[kind])
      : when === 'after_hours'
        ? fill(s.t('sharing.card.when.hours'), { n: hours ?? 0 })
        : s.t('sharing.card.when.end');
  return `${moment}: ${s.t(levelKey(kind, level))}`;
}

function recordsLine(policy: AnyPolicy, s: Speaker): string {
  const { identify, retentionDays } = policy.records;
  const kept = s.t(identify === 'named' ? 'sharing.card.named' : 'sharing.card.anonymous');
  const gone =
    retentionDays === DAYS_IN_YEAR
      ? s.t('sharing.card.retention.year')
      : fill(s.t('sharing.card.retention.days'), { n: retentionDays });
  return [kept, gone].join(SEP);
}

/**
 * The policy as five plain sentences, one per question the owner answered (what, who, when and
 * how much, what receivers see, what is kept). The sixth, control, is the share's own buttons.
 */
export function policySentences(
  kind: ShareKind,
  policy: AnyPolicy,
  speaker: Speaker,
  chapterNames?: readonly string[],
): PolicyLine[] {
  return [
    { id: 'what', text: whatLine(kind, policy, speaker, chapterNames) },
    { id: 'who', text: whoLine(policy, speaker) },
    { id: 'when', text: whenLine(kind, policy, speaker) },
    { id: 'reveal', text: revealLine(kind, policy, speaker) },
    { id: 'records', text: recordsLine(policy, speaker) },
  ];
}
