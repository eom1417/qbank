import { describe, expect, it } from 'vitest';
import { DEFAULT_POLICIES, type SharePolicy } from '../../../src/contracts/sharing.js';
import { issueFields, PRESETS } from '../../../src/web/capabilities/channels/presets.js';
import { allowedControls } from '../../../src/web/capabilities/channels/share-labels.js';
import { en } from '../../../src/web/platform/i18n/catalog-en.js';

describe('new-share presets (DEC-39)', () => {
  it('offers the four starting points, each a valid policy for its kind', () => {
    expect(PRESETS.map((p) => [p.id, p.kind])).toEqual([
      ['exam', 'exam'],
      ['practice', 'practice'],
      ['daily', 'agent'],
      ['api', 'agent'],
    ]);
    for (const preset of PRESETS) expect(issueFields(preset.kind, preset.policy)).toEqual({});
  });

  it('makes the daily question one question a day, explained six hours later', () => {
    const daily = PRESETS.find((p) => p.id === 'daily')?.policy;
    expect(daily?.content.size).toBe(1);
    expect(daily?.limits.batchesPerDay).toBe(1);
    expect(daily?.reveal).toEqual({ level: 'explained', when: 'after_hours', hours: 6 });
    expect(PRESETS.find((p) => p.id === 'api')?.policy).toBe(DEFAULT_POLICIES.agent);
  });
});

describe('issueFields', () => {
  it('names each broken rule on its own field, with a translated message', () => {
    const broken: SharePolicy = {
      ...DEFAULT_POLICIES.agent,
      content: { ...DEFAULT_POLICIES.agent.content, size: 12 },
      limits: {
        ...DEFAULT_POLICIES.agent.limits,
        startsAt: '2026-12-02T00:00:00.000Z',
        endsAt: '2026-12-01T00:00:00.000Z',
      },
      reveal: { level: 'score', when: 'after_hours', hours: null },
    };
    const fields = issueFields('agent', broken);
    expect(fields).toEqual({
      'content.size': 'sharing.issue.batch_max_10',
      'reveal.level': 'sharing.issue.agent_reveals_answers',
      'limits.endsAt': 'sharing.issue.ends_before_start',
      'reveal.hours': 'sharing.issue.hours_required',
    });
    for (const key of Object.values(fields)) expect(en[key]).toBeTruthy();
  });

  it('refuses a link share made for an agent, and a too-short access code', () => {
    const coded: SharePolicy = {
      ...DEFAULT_POLICIES.exam,
      audience: { access: 'code', code: 'ab', askId: false },
    };
    expect(issueFields('exam', coded)).toEqual({ 'audience.code': 'field.tooShort' });
    expect(issueFields('agent', DEFAULT_POLICIES.exam)['audience.access']).toBe(
      'sharing.issue.access_for_kind',
    );
  });

  it('asks for an end date before answers can wait for it', () => {
    const policy: SharePolicy = {
      ...DEFAULT_POLICIES.exam,
      reveal: { level: 'answers', when: 'after_end', hours: null },
    };
    expect(issueFields('exam', policy)).toEqual({ 'limits.endsAt': 'sharing.issue.end_required' });
  });
});

describe('allowedControls (question 6)', () => {
  it('offers only what each status allows', () => {
    expect(allowedControls('active')).toEqual({
      pause: true,
      resume: false,
      end: true,
      renew: true,
      archive: false,
    });
    expect(allowedControls('paused')).toMatchObject({ pause: false, resume: true, end: true });
    expect(allowedControls('ended')).toEqual({
      pause: false,
      resume: false,
      end: false,
      renew: false,
      archive: true,
    });
    expect(Object.values(allowedControls('archived')).some(Boolean)).toBe(false);
  });
});
