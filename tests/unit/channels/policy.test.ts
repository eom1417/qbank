import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICIES, type SharePolicy } from '../../../src/contracts/sharing.js';
import {
  feedbackEachQuestion,
  gate,
  revealNow,
  reveals,
  statusOf,
  type ShareState,
} from '../../../src/server/capabilities/channels/domain/policy.js';

const NOW = new Date('2026-11-10T12:00:00.000Z');
const HOUR = 3_600_000;
const at = (offsetHours: number) => new Date(NOW.getTime() + offsetHours * HOUR).toISOString();

function share(
  kind: ShareState['kind'] = 'agent',
  limits: Partial<SharePolicy['limits']> = {},
  state: Partial<Omit<ShareState, 'kind' | 'policy'>> = {},
): ShareState {
  const base = DEFAULT_POLICIES[kind];
  return {
    kind,
    policy: { ...base, limits: { ...base.limits, ...limits } },
    paused: false,
    endedAt: null,
    archivedAt: null,
    ...state,
  };
}

describe('the status of a share (DEC-39)', () => {
  it('reads archived, then ended, then paused, then scheduled, else active', () => {
    expect(statusOf(share(), NOW)).toBe('active');
    expect(statusOf(share('agent', { startsAt: at(1) }), NOW)).toBe('scheduled');
    expect(statusOf(share('agent', { startsAt: at(0) }), NOW)).toBe('active');
    expect(statusOf(share('agent', { endsAt: at(0) }), NOW)).toBe('ended');
    expect(statusOf(share('agent', { endsAt: at(1) }), NOW)).toBe('active');
    expect(statusOf(share('agent', {}, { paused: true }), NOW)).toBe('paused');
    const ended = share('agent', { startsAt: at(1) }, { paused: true, endedAt: NOW });
    expect(statusOf(ended, NOW)).toBe('ended');
    expect(statusOf({ ...ended, archivedAt: NOW }, NOW)).toBe('archived');
  });
});

describe('the gate', () => {
  it('lets an active share do everything', () => {
    for (const action of ['open', 'continue', 'submit', 'view'] as const)
      expect(gate(share(), action, NOW)).toEqual({ ok: true });
  });

  it('refuses something new or under way when paused, ended or not started, but not reading', () => {
    const cases = [
      [share('agent', {}, { paused: true }), 'channel_paused'],
      [share('agent', {}, { endedAt: NOW }), 'share_ended'],
      [share('agent', { endsAt: at(-1) }), 'share_ended'],
      [share('agent', { startsAt: at(2) }), 'share_not_started'],
    ] as const;
    for (const [state, code] of cases) {
      expect(gate(state, 'open', NOW)).toEqual({ ok: false, code });
      expect(gate(state, 'continue', NOW)).toEqual({ ok: false, code });
      expect(gate(state, 'view', NOW)).toEqual({ ok: true });
      expect(gate(state, 'submit', NOW)).toEqual({ ok: true });
    }
  });

  it('hides an archived share from every action', () => {
    const archived = share('exam', {}, { archivedAt: NOW });
    for (const action of ['open', 'continue', 'submit', 'view'] as const)
      expect(gate(archived, action, NOW)).toEqual({ ok: false, code: 'not_found' });
  });

  it('counts the daily batches and the attempts only when something new opens', () => {
    const daily = share('agent', { batchesPerDay: 2 });
    expect(gate(daily, 'open', NOW, { batchesToday: 1 }).ok).toBe(true);
    expect(gate(daily, 'open', NOW, { batchesToday: 2 })).toEqual({
      ok: false,
      code: 'share_limit_reached',
    });
    expect(gate(daily, 'view', NOW, { batchesToday: 5 }).ok).toBe(true);
    const exam = share('exam');
    expect(gate(exam, 'open', NOW, { attemptsUsed: 0 }).ok).toBe(true);
    expect(gate(exam, 'open', NOW, { attemptsUsed: 1 })).toEqual({
      ok: false,
      code: 'attempts_used',
    });
    expect(gate(exam, 'continue', NOW, { attemptsUsed: 1 }).ok).toBe(true);
    expect(gate(share('agent'), 'open', NOW, { batchesToday: 10_000 }).ok).toBe(true);
  });
});

const policy = (
  reveal: Partial<SharePolicy['reveal']>,
  endsAt: string | null = null,
  endedAt: Date | null = null,
) => ({
  endedAt,
  policy: {
    ...DEFAULT_POLICIES.exam,
    limits: { ...DEFAULT_POLICIES.exam.limits, endsAt },
    reveal: { ...DEFAULT_POLICIES.exam.reveal, ...reveal },
  },
});

describe('what is revealed, and when', () => {
  it('shows the level at once by default', () => {
    expect(revealNow(policy({ level: 'answers' }), NOW, NOW)).toEqual({
      level: 'answers',
      moreAt: null,
    });
  });

  it('waits the hours after the hand-in, to the millisecond', () => {
    const later = policy({ level: 'explained', when: 'after_hours', hours: 2 });
    const due = new Date(NOW.getTime() + 2 * HOUR);
    expect(revealNow(later, NOW, new Date(due.getTime() - 1))).toEqual({
      level: 'none',
      moreAt: due,
    });
    expect(revealNow(later, NOW, due)).toEqual({ level: 'explained', moreAt: null });
  });

  it('waits for the end, or the hand-in when that comes later; never without an end', () => {
    const atEnd = policy({ level: 'score', when: 'after_end' }, at(1));
    expect(revealNow(atEnd, NOW, NOW).moreAt?.toISOString()).toBe(at(1));
    expect(revealNow(atEnd, NOW, new Date(at(1))).level).toBe('score');
    const late = new Date(at(3));
    expect(revealNow(atEnd, late, late).level).toBe('score');
    expect(revealNow(policy({ when: 'after_end' }), NOW, new Date(at(1000)))).toEqual({
      level: 'none',
      moreAt: null,
    });
  });

  it('reveals after the end from the moment its owner ends the share early', () => {
    const early = policy({ level: 'score', when: 'after_end' }, at(5), new Date(at(1)));
    expect(revealNow(early, NOW, NOW).moreAt?.toISOString()).toBe(at(1));
    expect(revealNow(early, NOW, new Date(at(1))).level).toBe('score');
    const openEnded = policy({ level: 'score', when: 'after_end' }, null, new Date(at(2)));
    expect(revealNow(openEnded, NOW, new Date(at(2))).level).toBe('score');
  });

  it('never promises more when the level is none', () => {
    const none = policy({ level: 'none', when: 'after_hours', hours: 1 });
    expect(revealNow(none, NOW, NOW)).toEqual({ level: 'none', moreAt: null });
  });
});

describe('the reveal levels', () => {
  it('orders the levels, and gives practice feedback only when it shows answers at once', () => {
    expect(reveals('explained', 'answers')).toBe(true);
    expect(reveals('score', 'answers')).toBe(false);
    expect(reveals('none', 'none')).toBe(true);
    const practice = { kind: 'practice' as const, policy: DEFAULT_POLICIES.practice };
    expect(feedbackEachQuestion(practice)).toBe(true);
    const later = {
      ...practice,
      policy: {
        ...practice.policy,
        reveal: { level: 'answers' as const, when: 'after_hours' as const, hours: 1 },
      },
    };
    expect(feedbackEachQuestion(later)).toBe(false);
    expect(feedbackEachQuestion({ kind: 'exam', policy: DEFAULT_POLICIES.practice })).toBe(false);
  });
});
