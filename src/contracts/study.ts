import { z } from 'zod';
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
export const StudyKind = z.enum(['random', 'new', 'wrong', 'due', 'flagged']);
export type StudyKind = z.infer<typeof StudyKind>;

export const PreviewRequest = z.object({ scope: StudyScope, kind: StudyKind }).strict();
export const PreviewResponse = z.object({ available: z.number().int() }).strict();
export type PreviewResponse = z.infer<typeof PreviewResponse>;

export const StartSessionRequest = z
  .object({
    scope: StudyScope,
    kind: StudyKind,
    size: z.number().int().min(1).max(200),
    mode: z.literal('tutor'),
  })
  .strict();
export type StartSessionRequest = z.infer<typeof StartSessionRequest>;

export const SessionResponse = z
  .object({
    id: z.uuid(),
    mode: z.enum(['tutor', 'exam']),
    kind: z.enum(['random', 'new', 'wrong', 'due', 'flagged', 'retry']),
    total: z.number().int(),
    answered: z.number().int(),
    position: z.number().int(),
    status: z.enum(['active', 'finished']),
    createdAt: z.iso.datetime(),
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
export const AiExplanationRequest = z
  .object({ instanceId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/) })
  .strict();

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
