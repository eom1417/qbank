import { z } from 'zod';
import { ChannelStats } from './channels.js';

/**
 * Governed sharing (M30, DEC-39): every way a bank's questions leave it (an outside agent, a
 * daily WhatsApp/Telegram question, an exam or practice link) is one share with one policy.
 * The policy answers six fixed questions; one gate on the server enforces it for every
 * transport, and the same card shows it to the owner and to whoever receives the questions.
 */

/** How the questions travel: to an agent by key (API/MCP), or to people by a link. */
export const ShareKind = z.enum(['agent', 'exam', 'practice']);
export type ShareKind = z.infer<typeof ShareKind>;

/** 1. What is shared. Empty `chapterIds`: the whole bank. */
const ShareContent = z
  .object({
    chapterIds: z.array(z.uuid()).max(200),
    /** Questions per batch (agent, 1–10) or per attempt (exam/practice, 1–200). */
    size: z.number().int().min(1).max(200),
    /** Questions every attempt gets, before the random draw fills the rest (exam/practice). */
    fixedQuestionIds: z.array(z.uuid()).max(200),
    /** Agent: when every question has gone, start a new cycle or stop. */
    whenDone: z.enum(['restart', 'stop']),
    /** Exam: its scope never goes out through an agent share while the exam is not archived. */
    reserve: z.boolean(),
    /** Exam: the pass mark in percent; null means no pass/fail. */
    passPercent: z.number().int().min(1).max(100).nullable(),
  })
  .strict();

/** 2. Who receives it. An agent holds a key; people open a link, with a code if one is set. */
const ShareAudience = z.discriminatedUnion('access', [
  z.object({ access: z.literal('key') }).strict(),
  z.object({ access: z.literal('open'), askId: z.boolean() }).strict(),
  z
    .object({
      access: z.literal('code'),
      code: z.string().trim().min(4).max(32),
      askId: z.boolean(),
    })
    .strict(),
]);

/** 3. When, and how much. Null means no limit. */
const ShareLimits = z
  .object({
    startsAt: z.iso.datetime().nullable(),
    endsAt: z.iso.datetime().nullable(),
    /** Exam/practice: attempts per person (by the name and id they give). */
    attemptsPerPerson: z.number().int().min(1).max(20).nullable(),
    /** Exam: the whole attempt's time, started by the person's own "start". */
    durationSeconds: z
      .number()
      .int()
      .min(60)
      .max(6 * 3600)
      .nullable(),
    /** Exam: free movement, or forward only. */
    navigation: z.enum(['free', 'forward']),
    /** Agent: new batches a day (UTC). */
    batchesPerDay: z.number().int().min(1).max(1000).nullable(),
  })
  .strict();

/**
 * 4. What receivers see. `level` grows: nothing, the score, the right answers, and the
 * explanations too. `when`: at once (practice: after each question; exam: on submit; agent:
 * on request), some hours later, or once the share has ended.
 */
export const RevealLevel = z.enum(['none', 'score', 'answers', 'explained']);
export type RevealLevel = z.infer<typeof RevealLevel>;
const ShareReveal = z
  .object({
    level: RevealLevel,
    when: z.enum(['immediately', 'after_hours', 'after_end']),
    hours: z.number().int().min(1).max(168).nullable(),
  })
  .strict();

/** 5. What the owner keeps: names or anonymous records, and for how long. */
const ShareRecords = z
  .object({
    identify: z.enum(['named', 'anonymous']),
    retentionDays: z.number().int().min(7).max(1825),
  })
  .strict();

/** The whole policy. 6 (control: pause, end, renew, archive) is the share's lifecycle. */
export const SharePolicy = z
  .object({
    /** Who is sharing, as receivers see it (e.g. "Internal Medicine Program"). */
    presenter: z.string().trim().max(100),
    content: ShareContent,
    audience: ShareAudience,
    limits: ShareLimits,
    reveal: ShareReveal,
    records: ShareRecords,
  })
  .strict();
export type SharePolicy = z.infer<typeof SharePolicy>;

type Issue = { path: (string | number)[]; message: string };

/** Who may receive each kind, and how big an agent's batch may be. */
function kindIssues(kind: ShareKind, policy: SharePolicy): Issue[] {
  const isAgent = kind === 'agent';
  const issues: Issue[] = [];
  if (isAgent !== (policy.audience.access === 'key'))
    issues.push({ path: ['policy', 'audience', 'access'], message: 'access_for_kind' });
  if (isAgent && policy.content.size > 10)
    issues.push({ path: ['policy', 'content', 'size'], message: 'batch_max_10' });
  if (isAgent && !['answers', 'explained'].includes(policy.reveal.level))
    issues.push({ path: ['policy', 'reveal', 'level'], message: 'agent_reveals_answers' });
  return issues;
}

/** The dates and the reveal timing agree with each other. */
function timingIssues(policy: SharePolicy): Issue[] {
  const { startsAt, endsAt } = policy.limits;
  const issues: Issue[] = [];
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt))
    issues.push({ path: ['policy', 'limits', 'endsAt'], message: 'ends_before_start' });
  if (policy.reveal.when === 'after_hours' && policy.reveal.hours === null)
    issues.push({ path: ['policy', 'reveal', 'hours'], message: 'hours_required' });
  if (policy.reveal.when === 'after_end' && endsAt === null)
    issues.push({ path: ['policy', 'limits', 'endsAt'], message: 'end_required' });
  return issues;
}

/** The rules a kind adds to the policy; each broken one names its field. */
export const policyIssues = (kind: ShareKind, policy: SharePolicy): Issue[] => [
  ...kindIssues(kind, policy),
  ...timingIssues(policy),
];

const AGENT_POLICY: SharePolicy = {
  presenter: '',
  content: {
    chapterIds: [],
    size: 3,
    fixedQuestionIds: [],
    whenDone: 'restart',
    reserve: false,
    passPercent: null,
  },
  audience: { access: 'key' },
  limits: {
    startsAt: null,
    endsAt: null,
    attemptsPerPerson: null,
    durationSeconds: null,
    navigation: 'free',
    batchesPerDay: null,
  },
  reveal: { level: 'explained', when: 'immediately', hours: null },
  records: { identify: 'anonymous', retentionDays: 365 },
};

/**
 * Each kind's starting policy (DEC-39). The agent's equals how channels behaved before M30, so a
 * channel made then keeps its behaviour; the owner's presets start from these.
 */
export const DEFAULT_POLICIES: Readonly<Record<ShareKind, SharePolicy>> = {
  agent: AGENT_POLICY,
  exam: {
    ...AGENT_POLICY,
    content: { ...AGENT_POLICY.content, size: 20, reserve: true },
    audience: { access: 'open', askId: false },
    limits: { ...AGENT_POLICY.limits, attemptsPerPerson: 1, durationSeconds: 1800 },
    reveal: { level: 'score', when: 'immediately', hours: null },
    records: { identify: 'named', retentionDays: 365 },
  },
  practice: {
    ...AGENT_POLICY,
    content: { ...AGENT_POLICY.content, size: 20 },
    audience: { access: 'open', askId: false },
    records: { identify: 'anonymous', retentionDays: 90 },
  },
};

/** `POST /api/banks/:bankId/shares`: the owner confirms the right to share these questions. */
export const CreateShareRequest = z
  .object({
    kind: ShareKind,
    name: z.string().trim().min(1).max(100),
    policy: SharePolicy,
    rightsConfirmed: z.literal(true),
  })
  .strict()
  .superRefine((value, ctx) => {
    for (const issue of policyIssues(value.kind, value.policy))
      ctx.addIssue({ code: 'custom', ...issue });
  });
export type CreateShareRequest = z.infer<typeof CreateShareRequest>;

/** `PATCH /api/shares/:id`: a new policy makes a new version (new attempts follow it). */
export const UpdateShareRequest = z
  .object({ name: z.string().trim().min(1).max(100).optional(), policy: SharePolicy.optional() })
  .strict();

/** Derived from the lifecycle and the policy's dates, never stored. */
export const ShareStatus = z.enum(['scheduled', 'active', 'paused', 'ended', 'archived']);
export type ShareStatus = z.infer<typeof ShareStatus>;

export const ShareView = z
  .object({
    id: z.uuid(),
    bankId: z.uuid(),
    bankName: z.string(),
    kind: ShareKind,
    name: z.string(),
    policy: SharePolicy,
    version: z.number().int(),
    status: ShareStatus,
    /** The key's or link's first characters; the secret itself is shown once. */
    keyPrefix: z.string(),
    createdAt: z.iso.datetime(),
    lastUsedAt: z.iso.datetime().nullable(),
    /** Ready questions the share can draw from now (after reservations). */
    ready: z.number().int(),
    /** Agent: batches sent; exam/practice: attempts started. */
    uses: z.number().int(),
  })
  .strict();
export type ShareView = z.infer<typeof ShareView>;

export const ShareListResponse = z.object({ shares: z.array(ShareView) }).strict();
export type ShareListResponse = z.infer<typeof ShareListResponse>;

/** A new share or a renewed secret: the key (agent) or link token is in this answer only. */
export const ShareSecretResponse = z
  .object({ share: ShareView, secret: z.string(), link: z.string().nullable() })
  .strict();
export type ShareSecretResponse = z.infer<typeof ShareSecretResponse>;

/** One line of a share's append-only record (DEC-39): never edited, never removed alone. */
export const ShareEventType = z.enum([
  'created',
  'policy_changed',
  'renamed',
  'paused',
  'resumed',
  'secret_renewed',
  'ended',
  'archived',
  'batch_sent',
  'answers_revealed',
  'attempt_started',
  'attempt_submitted',
  'records_purged',
]);
export type ShareEventType = z.infer<typeof ShareEventType>;

export const ShareEventsResponse = z
  .object({
    events: z.array(
      z
        .object({
          at: z.iso.datetime(),
          type: ShareEventType,
          version: z.number().int(),
          detail: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
        })
        .strict(),
    ),
  })
  .strict();
export type ShareEventsResponse = z.infer<typeof ShareEventsResponse>;

/** `POST /api/banks/:bankId/shares/exposure`: before publishing, what of this scope is out. */
export const ExposureRequest = z
  .object({
    chapterIds: z.array(z.uuid()).max(200),
    fixedQuestionIds: z.array(z.uuid()).max(200),
  })
  .strict();
export const ExposureResponse = z
  .object({
    /** Ready questions in the scope. */
    inScope: z.number().int(),
    /** Of those, already sent by an agent share or asked in another exam/practice share. */
    exposed: z.number().int(),
    /** Of those, reserved by an exam share (an agent share would skip them). */
    reserved: z.number().int(),
  })
  .strict();
export type ExposureResponse = z.infer<typeof ExposureResponse>;

/** `GET /api/shares/:id/results` (exam/practice): each attempt and how each question fared. */
export const ShareResultsResponse = z
  .object({
    attempts: z.array(
      z
        .object({
          id: z.uuid(),
          /** Null when the share keeps anonymous records. */
          name: z.string().nullable(),
          personId: z.string().nullable(),
          version: z.number().int(),
          status: z.enum(['active', 'submitted']),
          endedBy: z.enum(['person', 'time', 'owner']).nullable(),
          startedAt: z.iso.datetime(),
          submittedAt: z.iso.datetime().nullable(),
          correct: z.number().int().nullable(),
          total: z.number().int(),
          percent: z.number().nullable(),
          passed: z.boolean().nullable(),
        })
        .strict(),
    ),
    summary: z
      .object({
        started: z.number().int(),
        submitted: z.number().int(),
        averagePercent: z.number().nullable(),
        passed: z.number().int().nullable(),
      })
      .strict(),
    questions: z.array(
      z
        .object({
          questionId: z.uuid(),
          stem: z.string(),
          asked: z.number().int(),
          answered: z.number().int(),
          correct: z.number().int(),
        })
        .strict(),
    ),
  })
  .strict();
export type ShareResultsResponse = z.infer<typeof ShareResultsResponse>;

/** `GET /api/shares/:id/stats` (agent): the channel's own numbers, as before (M23). */
export const ShareStatsResponse = ChannelStats;
