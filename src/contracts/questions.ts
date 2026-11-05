import { z } from 'zod';

/**
 * Where a question's answer came from: source, manual, ai_suggested (a permanent badge,
 * DEC-03), ai_verified (two solvers or a judge agreed, DEC-33), conflict or missing.
 */
export const AnswerProvenance = z.enum([
  'source',
  'manual',
  'ai_suggested',
  'ai_verified',
  'conflict',
  'missing',
]);
export type AnswerProvenance = z.infer<typeof AnswerProvenance>;

const NoteText = z.string().trim().max(3000);

/**
 * The AI's study note on a question (DEC-34), kept apart from the book's explanation: the topic
 * it tests, why the answer is right and each option right or wrong, "if it were…" variations,
 * points to remember, and sources (`url` only when a search opened the page and it answers).
 */
export const StudyNote = z
  .object({
    topic: z.string().trim().min(1).max(300),
    domain: z.string().trim().max(200),
    keyIdea: NoteText,
    whyAnswer: NoteText,
    options: z.array(z.object({ letter: z.string().max(2), why: NoteText }).strict()).max(8),
    ifThen: z.array(NoteText).max(6),
    pearls: z.array(NoteText).max(8),
    sources: z
      .array(
        z
          .object({ title: z.string().trim().min(1).max(300), url: z.url().max(600).nullable() })
          .strict(),
      )
      .max(8),
    /** What is wrong with the question as printed (missing data, no right option…), if anything. */
    questionIssue: NoteText.nullable(),
  })
  .strict();
export type StudyNote = z.infer<typeof StudyNote>;

/** A saved note: a full topic review (with a web search) or a short note on the options. */
export const SavedStudyNote = StudyNote.extend({
  kind: z.enum(['topic_review', 'options']),
  researched: z.boolean(),
}).strict();
export type SavedStudyNote = z.infer<typeof SavedStudyNote>;

/**
 * `GET /api/banks/:bankId/topic-cards`: the bank's questions that have a topic review, to study
 * as cards when they cannot be answered as printed (DEC-34).
 */
export const TopicCardsResponse = z
  .object({
    cards: z.array(
      z
        .object({
          id: z.uuid(),
          stem: z.string(),
          options: z.array(
            z.object({ letter: z.string(), label: z.string(), text: z.string() }).strict(),
          ),
          answers: z.array(z.string()),
          note: SavedStudyNote,
        })
        .strict(),
    ),
  })
  .strict();
export type TopicCardsResponse = z.infer<typeof TopicCardsResponse>;

/** One printed option of a question: its letter, the label as printed, and its text. */
export const QuestionOption = z
  .object({ letter: z.string(), label: z.string(), text: z.string() })
  .strict();

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
    options: z.array(QuestionOption),
    multiSelect: z.boolean(),
    answers: z.array(z.string()),
    provenance: AnswerProvenance,
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
    /** The file's own answer, when the AI triage overturned it (DEC-16). */
    fileAnswer: z.string().nullable(),
    /** The triage's deciding reason (DEC-33). */
    aiNote: z.string().nullable(),
    /** What the AI changed (`polished`, `options_added`, `answer_verified`…), DEC-34. */
    aiChanges: z.array(z.string()),
    /** The AI's study note, apart from the book's explanation (DEC-34). */
    studyNote: SavedStudyNote.nullable(),
    /** Left for later in review (M7.3). */
    deferred: z.boolean(),
    /** A re-import's different reading of this edited question, to compare (FR-10-006). */
    reimportText: z
      .object({
        stem: z.string(),
        options: z.array(z.object({ letter: z.string(), text: z.string() })),
        explanation: z.string().nullable(),
      })
      .nullable(),
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
    /** 1 (easy) to 5 (hard), set by the owner; null clears it (FR-11-005). */
    difficulty: z.number().int().min(1).max(5).nullable().optional(),
    /** The change applies the user's AI fix suggestion (FR-01-009: the history says so). */
    fromAiSuggestion: z.boolean().optional(),
  })
  .strict();
export type EditQuestionRequest = z.infer<typeof EditQuestionRequest>;
