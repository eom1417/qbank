import { z } from 'zod';
import { AiTarget } from './providers.js';
import { QuestionOption } from './questions.js';

const Ids = z.array(z.uuid()).max(200);

/** Where a session draws from (FR-12-001, FR-03-006); lists left out mean "all of them". */
export const StudyScope = z
  .object({
    bankIds: z.array(z.uuid()).min(1).max(20),
    chapterIds: Ids.optional(),
    topicIds: Ids.optional(),
    sourceIds: Ids.optional(),
    tagIds: Ids.optional(),
    flaggedOnly: z.boolean().optional(),
    favoritesOnly: z.boolean().optional(),
  })
  .strict();
export type StudyScope = z.infer<typeof StudyScope>;

/** Random, never answered, last answered wrong, due again, or flagged (FR-12-002). */
export const StudyKind = z.enum(['random', 'new', 'wrong', 'due', 'flagged', 'weak', 'smart_mix']);
export type StudyKind = z.infer<typeof StudyKind>;

/** Smart Mix shares in percent: new, weak or wrong, due (FR-14-007; default 50/30/20). */
export const MixShares = z
  .object({
    new: z.number().int().min(0).max(100),
    weak: z.number().int().min(0).max(100),
    due: z.number().int().min(0).max(100),
  })
  .strict()
  .refine((s) => s.new + s.weak + s.due === 100, { message: 'must_total_100' });
export type MixShares = z.infer<typeof MixShares>;

const MixCounts = z
  .object({ new: z.number().int(), weak: z.number().int(), due: z.number().int() })
  .strict();

export const PreviewRequest = z
  .object({ scope: StudyScope, kind: StudyKind, shares: MixShares.optional() })
  .strict();
export const PreviewResponse = z
  .object({ available: z.number().int(), groups: MixCounts.optional() })
  .strict();
export type PreviewResponse = z.infer<typeof PreviewResponse>;

/**
 * An exam's timing, shown with its rules before starting (FR-13-002…005): none, a total time,
 * or a time per question (forward only, DEC-07 assumed).
 */
export const ExamTiming = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }).strict(),
  z
    .object({
      kind: z.literal('total'),
      seconds: z
        .number()
        .int()
        .min(60)
        .max(6 * 3600),
    })
    .strict(),
  z
    .object({ kind: z.literal('per_question'), seconds: z.number().int().min(10).max(3600) })
    .strict(),
]);
export type ExamTiming = z.infer<typeof ExamTiming>;

const SessionBase = {
  scope: StudyScope,
  kind: StudyKind,
  size: z.number().int().min(1).max(200),
  shares: MixShares.optional(),
};

export const StartSessionRequest = z.discriminatedUnion('mode', [
  z.object({ ...SessionBase, mode: z.literal('tutor') }).strict(),
  z.object({ ...SessionBase, mode: z.literal('exam'), timing: ExamTiming }).strict(),
]);
export type StartSessionRequest = z.infer<typeof StartSessionRequest>;

export const SessionResponse = z
  .object({
    id: z.uuid(),
    mode: z.enum(['tutor', 'exam']),
    kind: z.enum(['random', 'new', 'wrong', 'due', 'flagged', 'retry', 'weak', 'smart_mix']),
    /** A Smart Mix session's real composition, never the requested shares (FR-14-002). */
    mix: z
      .object({ new: z.number().int(), weak: z.number().int(), due: z.number().int() })
      .strict()
      .nullable(),
    total: z.number().int(),
    answered: z.number().int(),
    position: z.number().int(),
    status: z.enum(['active', 'finished']),
    createdAt: z.iso.datetime(),
    timing: z.enum(['none', 'total', 'per_question']),
    timingSeconds: z.number().int().nullable(),
    /** Ended by the owner, or by the time running out (FR-13-011). */
    endedBy: z.enum(['owner', 'time']).nullable(),
  })
  .strict();
export type SessionResponse = z.infer<typeof SessionResponse>;

export const ActiveSessionsResponse = z.object({ sessions: z.array(SessionResponse) }).strict();

/** What the solution adds once the answer is sent (never before, FR-12-003, UAT-041). */
const Solution = z
  .object({
    chosen: z.array(z.string()),
    correct: z.boolean(),
    answers: z.array(z.string()),
    /** The book's explanation as printed; null says "not available" (FR-12-004). */
    explanation: z.string().nullable(),
  })
  .strict();

/** One question of the session, as it was when the session began (FR-23-007). */
export const ItemResponse = z
  .object({
    position: z.number().int(),
    total: z.number().int(),
    questionId: z.uuid().nullable(),
    stem: z.string(),
    options: z.array(QuestionOption),
    multiSelect: z.boolean(),
    pictureIds: z.array(z.uuid()),
    flagged: z.boolean(),
    favorite: z.boolean(),
    solution: Solution.nullable(),
    /** Why a Smart Mix chose this question (FR-14-008). */
    reason: z.enum(['new', 'weak', 'due']).nullable(),
    /** An exam answer saved so far (never graded before submission). */
    saved: z.array(z.string()),
    /** This exam item's own flag (FR-13-009). */
    examFlag: z.boolean(),
    /** Whether the answer can still be changed (exam timing rules). */
    changeable: z.boolean(),
  })
  .strict();
export type ItemResponse = z.infer<typeof ItemResponse>;

export const AnswerRequest = z
  .object({
    chosen: z
      .array(z.string().regex(/^[A-J]$/))
      .min(1)
      .max(10),
    seconds: z.number().int().min(0).max(86400),
  })
  .strict();

export const PositionRequest = z.object({ position: z.number().int().min(0) }).strict();

/** The end of a session (FR-12-010, UI-15): every rate says what it is out of. */
export const SummaryResponse = z
  .object({
    total: z.number().int(),
    answered: z.number().int(),
    correct: z.number().int(),
    wrong: z.number().int(),
    skipped: z.number().int(),
    seconds: z.number().int(),
    byChapter: z.array(
      z
        .object({
          chapterId: z.uuid().nullable(),
          answered: z.number().int(),
          correct: z.number().int(),
        })
        .strict(),
    ),
    wrongItems: z.array(z.object({ position: z.number().int(), excerpt: z.string() }).strict()),
  })
  .strict();
export type SummaryResponse = z.infer<typeof SummaryResponse>;

/** The owner's flag and favourite on a question (FR-12-007); neither is an answer. */
export const MarkRequest = z
  .object({ flagged: z.boolean().optional(), favorite: z.boolean().optional() })
  .strict();
export const MarkResponse = z.object({ flagged: z.boolean(), favorite: z.boolean() }).strict();

/** The user's AI explains after the answer (FR-08-005, FR-08-006): labelled, never the book's. */
export const AiExplanationRequest = AiTarget;

export const AiExplanation = z
  .object({
    explanation: z.string().max(4000),
    options: z.array(z.object({ letter: z.string(), why: z.string().max(1000) }).strict()).max(10),
    confidence: z.enum(['high', 'medium', 'low']),
    caveats: z.string().max(1000),
  })
  .strict();

export const AiExplanationResponse = z.discriminatedUnion('outcome', [
  AiExplanation.extend({ outcome: z.literal('explained'), generatedBy: z.string() }).strict(),
  z.object({ outcome: z.literal('failed'), failure: z.string() }).strict(),
]);
export type AiExplanationResponse = z.infer<typeof AiExplanationResponse>;

/** The exam as the map and the pre-submission check show it (FR-13-008, FR-13-010, UI-18). */
export const ExamStateResponse = z
  .object({
    status: z.enum(['active', 'finished']),
    timing: z.enum(['none', 'total', 'per_question']),
    /** Seconds left of the exam (total) or of the current question; null when untimed. */
    secondsLeft: z.number().int().nullable(),
    position: z.number().int(),
    items: z.array(
      z
        .object({
          position: z.number().int(),
          answered: z.boolean(),
          flagged: z.boolean(),
          changeable: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();
export type ExamStateResponse = z.infer<typeof ExamStateResponse>;

export const ChoiceRequest = z
  .object({ chosen: z.array(z.string().regex(/^[A-J]$/)).max(10) })
  .strict();

export const FlagRequest = z.object({ flagged: z.boolean() }).strict();

/** Submitting is a deliberate act: never the result of a stray "next" (FR-13-010). */
export const SubmitRequest = z.object({ confirm: z.literal(true) }).strict();

/** What a changed answer key would mean for past attempts (FR-07-007, FR-24-004, UAT-031). */
export const AnswerImpactResponse = z
  .object({
    attempts: z.number().int(),
    sessions: z.number().int(),
    /** Attempts whose result would differ under the new key; they stay as graded. */
    wouldChange: z.number().int(),
  })
  .strict();
export type AnswerImpactResponse = z.infer<typeof AnswerImpactResponse>;

/** Today's reviews (FR-15-005, UI-20): what is due and why, or what to do instead. */
export const DueResponse = z
  .object({
    count: z.number().int(),
    items: z.array(
      z
        .object({
          questionId: z.uuid(),
          excerpt: z.string(),
          chapterId: z.uuid().nullable(),
          streak: z.number().int(),
          intervalDays: z.number().int(),
          dueAt: z.iso.datetime(),
        })
        .strict(),
    ),
    /** With nothing due: how many new and weak questions are there instead (UAT-063). */
    alternatives: z.object({ new: z.number().int(), weak: z.number().int() }).strict(),
  })
  .strict();
export type DueResponse = z.infer<typeof DueResponse>;

/** Chapters and topics by need (FR-15-006): weak and due first; small samples are said. */
export const TopicsResponse = z
  .object({
    topics: z.array(
      z
        .object({
          chapterId: z.uuid().nullable(),
          topicId: z.uuid().nullable(),
          questions: z.number().int(),
          answered: z.number().int(),
          /** 0–1 over answered questions; consistency, not one answer (FR-15-003). */
          mastery: z.number(),
          weak: z.number().int(),
          due: z.number().int(),
          smallSample: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();
export type TopicsResponse = z.infer<typeof TopicsResponse>;

/** One question's level and next review, with what they rest on (FR-15-002, FR-15-008). */
export const MasteryResponse = z
  .object({
    level: z.enum(['new', 'weak', 'learning', 'good', 'mastered']),
    streak: z.number().int(),
    attempts: z.number().int(),
    intervalDays: z.number().int().nullable(),
    dueAt: z.iso.datetime().nullable(),
  })
  .strict();
export type MasteryResponse = z.infer<typeof MasteryResponse>;
