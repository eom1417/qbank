import { z } from 'zod';

/** One side of a duplicate pair: the question, its book and page, and its approved answer. */
const PairSide = z
  .object({
    id: z.uuid(),
    stem: z.string(),
    options: z.array(z.object({ letter: z.string(), text: z.string() })),
    answers: z.array(z.string()),
    provenance: z.string(),
    status: z.string(),
    page: z.number().int(),
    number: z.number().int(),
    fileName: z.string(),
  })
  .strict();

/** Two questions that are the same or alike, and what the owner decided (UI-12, FR-10-003). */
export const DuplicatePair = z
  .object({
    id: z.uuid(),
    kind: z.enum(['exact', 'similar']),
    similarity: z.number(),
    /** Words only one of them has that may change the answer: except, not, a dose… */
    differences: z.array(z.string()),
    decision: z.enum(['kept_both', 'reference', 'excluded']).nullable(),
    answersDiffer: z.boolean(),
    a: PairSide,
    b: PairSide,
  })
  .strict();
export type DuplicatePair = z.infer<typeof DuplicatePair>;

export const DuplicatePairsResponse = z.object({ pairs: z.array(DuplicatePair) }).strict();
export type DuplicatePairsResponse = z.infer<typeof DuplicatePairsResponse>;

/** Keep both; make one the reference (the other is hidden); or hide one (FR-10-004). */
export const PairDecisionRequest = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('kept_both') }).strict(),
  z
    .object({
      decision: z.literal('reference'),
      questionId: z.uuid(),
      /** The two approved answers differ: the owner says so on purpose (UAT-039). */
      acknowledgeDifferentAnswers: z.boolean().optional(),
    })
    .strict(),
  z.object({ decision: z.literal('excluded'), questionId: z.uuid() }).strict(),
]);
export type PairDecisionRequest = z.infer<typeof PairDecisionRequest>;

/** Moving or copying questions to another of the owner's banks (FR-03-009). */
export const TransferRequest = z
  .object({
    questionIds: z.array(z.uuid()).min(1).max(1000),
    targetBankId: z.uuid(),
    mode: z.enum(['move', 'copy']),
  })
  .strict();
export type TransferRequest = z.infer<typeof TransferRequest>;

export const TransferResponse = z
  .object({ transferred: z.number().int(), duplicates: z.number().int() })
  .strict();
export type TransferResponse = z.infer<typeof TransferResponse>;

/** The owner chooses between their edited text and a re-import's new reading (FR-10-006). */
export const ReimportChoiceRequest = z.object({ use: z.enum(['new', 'mine']) }).strict();
