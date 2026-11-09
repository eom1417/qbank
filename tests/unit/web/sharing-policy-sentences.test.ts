import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICIES, type SharePolicy } from '../../../src/contracts/sharing.js';
import type { PublicPolicy } from '../../../src/contracts/take.js';
import {
  fill,
  levelKey,
  policySentences,
  type Speaker,
} from '../../../src/web/capabilities/channels/policy-sentences.js';
import { ar } from '../../../src/web/platform/i18n/catalog-ar.js';
import { en } from '../../../src/web/platform/i18n/catalog-en.js';

const speaker = (catalog: Record<string, string>): Speaker => ({
  t: (key) => catalog[key] ?? `MISSING:${key}`,
  date: (iso) => iso.slice(0, 10),
});
const EN = speaker(en);
const texts = (kind: 'agent' | 'exam' | 'practice', policy: SharePolicy | PublicPolicy) =>
  Object.fromEntries(policySentences(kind, policy, EN).map((l) => [l.id, l.text]));

const CHAPTER = '3f1c2a4b-5d6e-4f70-8a91-b2c3d4e5f607';

describe('fill', () => {
  it('puts values in their places and leaves unknown names as written', () => {
    expect(fill('{n} of {total} ({x})', { n: 3, total: 'ten' })).toBe('3 of ten ({x})');
  });
});

describe('policy sentences (DEC-39)', () => {
  it('says the formal exam preset in five plain lines, one per question', () => {
    const lines = policySentences('exam', DEFAULT_POLICIES.exam, EN);
    expect(lines.map((l) => l.id)).toEqual(['what', 'who', 'when', 'reveal', 'records']);
    expect(texts('exam', DEFAULT_POLICIES.exam)).toEqual({
      what: 'Questions: 20 per attempt, at random from the whole bank · kept out of daily questions while this exam lasts',
      who: 'Anyone with the link · asks for a name',
      when: 'Open now, no end date · one attempt · time: 30 min, starting at "Start"',
      reveal: 'After submitting: the score only',
      records: 'Results kept by name · deleted after a year',
    });
  });

  it('names the chosen chapters for the owner and counts them for receivers', () => {
    const policy = {
      ...DEFAULT_POLICIES.exam,
      content: { ...DEFAULT_POLICIES.exam.content, chapterIds: [CHAPTER, CHAPTER] },
    };
    const owner = policySentences('exam', policy, EN, ['Heart', 'Kidney'])[0]?.text;
    expect(owner).toContain('from Heart, Kidney');
    expect(texts('exam', policy).what).toContain('from 2 chosen chapters');
  });

  it('describes a code-protected exam with dates, attempts, pace and later reveal', () => {
    const policy: PublicPolicy = {
      ...DEFAULT_POLICIES.exam,
      content: { ...DEFAULT_POLICIES.exam.content, reserve: false, passPercent: 60 },
      audience: { access: 'code', askId: true },
      limits: {
        ...DEFAULT_POLICIES.exam.limits,
        startsAt: '2026-12-01T08:00:00.000Z',
        endsAt: '2026-12-02T08:00:00.000Z',
        attemptsPerPerson: 3,
        durationSeconds: null,
        navigation: 'forward',
      },
      reveal: { level: 'explained', when: 'after_end', hours: null },
      records: { identify: 'anonymous', retentionDays: 90 },
    };
    expect(texts('exam', policy)).toEqual({
      what: 'Questions: 20 per attempt, at random from the whole bank · pass mark 60%',
      who: 'Anyone with the link and the code · asks for a name and an ID',
      when: 'From 2026-12-01 to 2026-12-02 · attempts: 3 per person · no time limit · forward only, no going back',
      reveal: 'After the share ends: the score, the right answers and the explanations',
      records: 'Results kept without names · deleted after 90 days',
    });
  });
});

describe('policy sentences by kind', () => {
  it('describes the daily question for WhatsApp as an agent share', () => {
    const daily: SharePolicy = {
      ...DEFAULT_POLICIES.agent,
      content: { ...DEFAULT_POLICIES.agent.content, size: 1, whenDone: 'stop' },
      limits: {
        ...DEFAULT_POLICIES.agent.limits,
        batchesPerDay: 1,
        startsAt: '2026-12-01T00:00:00Z',
      },
      reveal: { level: 'answers', when: 'after_hours', hours: 6 },
    };
    expect(texts('agent', daily)).toEqual({
      what: 'Questions: 1 per batch, from the whole bank · stops once all have gone out',
      who: 'Only the program holding the key (API or MCP)',
      when: 'Opens 2026-12-01 · batches: up to 1 a day',
      reveal: 'After 6 h: the right answers',
      records: 'Results kept without names · deleted after a year',
    });
    expect(texts('agent', DEFAULT_POLICIES.agent).when).toBe(
      'Open now, no end date · no daily limit',
    );
  });

  it('gives practice its own reveal moment, open end date and fixed questions', () => {
    const practice: SharePolicy = {
      ...DEFAULT_POLICIES.practice,
      content: { ...DEFAULT_POLICIES.practice.content, fixedQuestionIds: [CHAPTER] },
      limits: { ...DEFAULT_POLICIES.practice.limits, endsAt: '2027-01-01T00:00:00Z' },
    };
    const lines = texts('practice', practice);
    expect(lines.what).toContain('1 of them the same for everyone');
    expect(lines.when).toBe('Open until 2027-01-01 · unlimited attempts');
    expect(lines.reveal).toBe(
      'After each question: the score, the right answers and the explanations',
    );
  });
});

describe('policy sentences: privacy and language', () => {
  it('never shows an access code, and an agent never gets a score wording', () => {
    const coded: SharePolicy = {
      ...DEFAULT_POLICIES.exam,
      audience: { access: 'code', code: 'SECRET-42', askId: false },
    };
    const all = policySentences('exam', coded, EN)
      .map((l) => l.text)
      .join(' ');
    expect(all).not.toContain('SECRET-42');
    expect(levelKey('agent', 'explained')).toBe('sharing.card.level.agent.explained');
    expect(levelKey('exam', 'explained')).toBe('sharing.card.level.explained');
  });

  it('speaks Arabic with every template filled', () => {
    const lines = policySentences('exam', DEFAULT_POLICIES.exam, speaker(ar));
    const all = lines.map((l) => l.text).join('\n');
    expect(all).not.toMatch(/MISSING|\{\w+\}/);
    expect(lines[3]?.text).toBe('بعد التسليم: الدرجة فقط');
    expect(lines[4]?.text).toBe('النتائج بالاسم · تُحذف بعد سنة');
  });
});
