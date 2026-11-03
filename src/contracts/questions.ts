import { z } from 'zod';

/** One question with its answer, where the answer came from and where it stands (M6). */
export const QuestionResponse = z
  .object({
    id: z.uuid(),
    sourceId: z.uuid(),
    number: z.number().int(),
    page: z.number().int(),
    kind: z.enum(['mcq', 'essay']),
    stem: z.string(),
    options: z.array(
      z.object({ letter: z.string(), label: z.string(), text: z.string() }).strict(),
    ),
    multiSelect: z.boolean(),
    answers: z.array(z.string()),
    /** source, manual, ai_suggested (a permanent badge, DEC-03), conflict or missing. */
    provenance: z.enum(['source', 'manual', 'ai_suggested', 'conflict', 'missing']),
    evidence: z.string().nullable(),
    aiAccepted: z.boolean(),
    /** The author's explanation as printed (FR-07-009). */
    explanation: z.string().nullable(),
    status: z.enum(['detected', 'needs_review', 'eligible', 'excluded', 'archived']),
    reviewReasons: z.array(z.string()),
    chapterId: z.uuid().nullable(),
    topicId: z.uuid().nullable(),
    /** none, suggested (from the bank's names) or manual (FR-08-002). */
    classification: z.enum(['none', 'suggested', 'manual']),
    /** Tags on the question: suggested from the account's tag names, or set by the user. */
    tags: z.array(z.object({ id: z.uuid(), origin: z.enum(['suggested', 'manual']) }).strict()),
    /** unset, manual or inferred from results, always said (FR-11-005). */
    difficulty: z
      .object({ kind: z.enum(['unset', 'manual', 'inferred']), value: z.number().int().nullable() })
      .strict(),
    version: z.number().int(),
  })
  .strict();
export type QuestionResponse = z.infer<typeof QuestionResponse>;
