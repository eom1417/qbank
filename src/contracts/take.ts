import { z } from 'zod';
import { RevealLevel, SharePolicy, ShareStatus } from './sharing.js';

/**
 * Taking a shared exam or practice (M30, DEC-39), with no account. The link token opens the
 * share (`/api/take/v1/links/:token`); starting gives an attempt token that the browser keeps
 * and sends as `Authorization: Bearer qba_…` for everything after. The page is the study
 * exam page under the share's policy: the server decides what it may show.
 */

const Letter = z.string().regex(/^[A-J]$/);

/** The policy as receivers see it: never the access code. */
export const PublicPolicy = SharePolicy.extend({
  audience: z.discriminatedUnion('access', [
    z.object({ access: z.literal('open'), askId: z.boolean() }).strict(),
    z.object({ access: z.literal('code'), askId: z.boolean() }).strict(),
  ]),
}).strict();
export type PublicPolicy = z.infer<typeof PublicPolicy>;

/** `GET /api/take/v1/links/:token`: the landing page, with the rules before starting. */
export const TakeLandingResponse = z
  .object({
    kind: z.enum(['exam', 'practice']),
    name: z.string(),
    policy: PublicPolicy,
    status: ShareStatus,
    /** Questions in each attempt. */
    total: z.number().int(),
  })
  .strict();
export type TakeLandingResponse = z.infer<typeof TakeLandingResponse>;

/** `POST /api/take/v1/links/:token/attempts`. */
export const StartAttemptRequest = z
  .object({
    name: z.string().trim().min(2).max(100),
    personId: z.string().trim().min(1).max(50).optional(),
    code: z.string().trim().min(1).max(32).optional(),
  })
  .strict();

/** The attempt token is in this answer only; the browser keeps it to come back. */
export const StartAttemptResponse = z.object({ attemptId: z.uuid(), token: z.string() }).strict();
export type StartAttemptResponse = z.infer<typeof StartAttemptResponse>;

/** What the policy lets the page offer; the server refuses anything outside it as well. */
export const TakeAllowed = z
  .object({
    navigation: z.enum(['free', 'forward']),
    flag: z.boolean(),
    /** Practice with an immediate reveal: the answer after each question. */
    feedbackEachQuestion: z.boolean(),
  })
  .strict();
export type TakeAllowed = z.infer<typeof TakeAllowed>;

/** `GET /api/take/v1/attempt`: where the attempt stands; the clock is the server's. */
export const TakeStateResponse = z
  .object({
    kind: z.enum(['exam', 'practice']),
    name: z.string(),
    presenter: z.string(),
    status: z.enum(['active', 'submitted']),
    total: z.number().int(),
    answered: z.number().int(),
    position: z.number().int(),
    secondsLeft: z.number().int().nullable(),
    allowed: TakeAllowed,
    items: z.array(
      z
        .object({ position: z.number().int(), answered: z.boolean(), flagged: z.boolean() })
        .strict(),
    ),
  })
  .strict();
export type TakeStateResponse = z.infer<typeof TakeStateResponse>;

const Feedback = z
  .object({
    correct: z.boolean(),
    answers: z.array(Letter),
    explanation: z.string().nullable(),
  })
  .strict();

/** `GET|PUT /api/take/v1/attempt/items/:position`: one question, never its answer unless allowed. */
export const TakeItemResponse = z
  .object({
    position: z.number().int(),
    total: z.number().int(),
    stem: z.string(),
    options: z.array(z.object({ letter: Letter, label: z.string(), text: z.string() }).strict()),
    multiSelect: z.boolean(),
    /** Fetched with the attempt token: `/api/take/v1/attempt/pictures/:id`. */
    pictureIds: z.array(z.uuid()),
    saved: z.array(Letter),
    flagged: z.boolean(),
    changeable: z.boolean(),
    /** Practice with an immediate reveal, once answered; null otherwise. */
    feedback: Feedback.nullable(),
  })
  .strict();
export type TakeItemResponse = z.infer<typeof TakeItemResponse>;

export const TakeChoiceRequest = z.object({ chosen: z.array(Letter).min(1).max(10) }).strict();
export const TakeFlagRequest = z.object({ flagged: z.boolean() }).strict();

/** `GET /api/take/v1/attempt/result` (and the answer to submitting): only what is revealed. */
export const TakeResultResponse = z
  .object({
    status: z.enum(['active', 'submitted']),
    endedBy: z.enum(['person', 'time', 'owner']).nullable(),
    level: RevealLevel,
    /** When more will be shown (after some hours, or when the share ends); null if never. */
    moreAt: z.iso.datetime().nullable(),
    score: z
      .object({
        correct: z.number().int(),
        total: z.number().int(),
        percent: z.number(),
        passed: z.boolean().nullable(),
      })
      .strict()
      .nullable(),
    items: z
      .array(
        z
          .object({
            position: z.number().int(),
            stem: z.string(),
            chosen: z.array(Letter),
            correct: z.boolean(),
            answers: z.array(Letter),
            explanation: z.string().nullable(),
          })
          .strict(),
      )
      .nullable(),
  })
  .strict();
export type TakeResultResponse = z.infer<typeof TakeResultResponse>;
