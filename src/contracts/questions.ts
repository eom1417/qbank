import { z } from 'zod';

/** One question with its answer, where the answer came from and where it stands (M6). */
export const QuestionResponse = z
  .object({
    id: z.uuid(),
    bankId: z.uuid(),
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
    /** Newer information, kept apart from the book's answer (FR-24-002). */
    updateNote: z.string().nullable(),
    /** Left for later in review (M7.3). */
    deferred: z.boolean(),
    /** Its figures and tables in order (M5), served at `/api/media/:id`. */
    pictures: z.array(
      z
        .object({
          id: z.uuid(),
          kind: z.enum(['figure', 'table']),
          certain: z.boolean(),
          lowQuality: z.boolean(),
          width: z.number().int(),
          height: z.number().int(),
        })
        .strict(),
    ),
    version: z.number().int(),
  })
  .strict();
export type QuestionResponse = z.infer<typeof QuestionResponse>;

const OptionLetter = z.string().regex(/^[A-J]$/);

/**
 * The owner's edit of a question (FR-09-003, UI-11). Only the fields sent change. The version
 * the editor started from must still be current, so two tabs never overwrite each other.
 */
export const EditQuestionRequest = z
  .object({
    expectedVersion: z.number().int().min(0),
    stem: z.string().trim().min(1).max(5000).optional(),
    options: z
      .array(z.object({ letter: OptionLetter, text: z.string().trim().max(2000) }).strict())
      .min(2)
      .max(10)
      .refine((options) => new Set(options.map((o) => o.letter)).size === options.length, {
        message: 'duplicate_letters',
      })
      .optional(),
    answers: z.array(OptionLetter).max(10).optional(),
    explanation: z.string().trim().max(20000).nullable().optional(),
    /** Newer information, never mixed with the book's answer (FR-24-002). */
    updateNote: z.string().trim().max(5000).nullable().optional(),
    chapterId: z.uuid().nullable().optional(),
    topicId: z.uuid().nullable().optional(),
    tagIds: z.array(z.uuid()).max(50).optional(),
    /** The change applies the user's AI fix suggestion (FR-01-009: the history says so). */
    fromAiSuggestion: z.boolean().optional(),
  })
  .strict();
export type EditQuestionRequest = z.infer<typeof EditQuestionRequest>;
