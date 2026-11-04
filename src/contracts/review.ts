import { z } from 'zod';

/** How much a question risks a wrong answer in study (FR-09-001). */
const Severity = z.enum(['high', 'medium', 'low']);

/** One question waiting for the owner, in the bank's review queue (UI-10). */
export const ReviewItem = z
  .object({
    id: z.uuid(),
    sourceId: z.uuid(),
    page: z.number().int(),
    number: z.number().int(),
    kind: z.enum(['mcq', 'essay']),
    /** The first words of the stem, to recognise it. */
    excerpt: z.string(),
    status: z.enum(['detected', 'needs_review', 'eligible', 'excluded', 'archived']),
    reasons: z.array(z.string()),
    severity: Severity,
    provenance: z.enum(['source', 'manual', 'ai_suggested', 'conflict', 'missing']),
    deferred: z.boolean(),
    openReports: z.number().int(),
  })
  .strict();
export type ReviewItem = z.infer<typeof ReviewItem>;

/** Worst first, then the book's order; deferred questions after the rest. */
export const ReviewQueueResponse = z.object({ items: z.array(ReviewItem) }).strict();
export type ReviewQueueResponse = z.infer<typeof ReviewQueueResponse>;

/** Safe bulk approval (FR-09-006): the questions it may take, or all safe ones in the bank. */
export const BulkApproveRequest = z
  .object({ questionIds: z.array(z.uuid()).max(2000).optional() })
  .strict();
export type BulkApproveRequest = z.infer<typeof BulkApproveRequest>;

export const BulkApproveResponse = z
  .object({ approved: z.number().int(), keptForReview: z.number().int() })
  .strict();
export type BulkApproveResponse = z.infer<typeof BulkApproveResponse>;

/** One saved state of a question and what made it (FR-09-008, FR-08-008). */
export const QuestionVersion = z
  .object({
    version: z.number().int(),
    origin: z.string(),
    createdAt: z.iso.datetime(),
    stem: z.string(),
    options: z.array(z.object({ letter: z.string(), text: z.string() })),
    answers: z.array(z.string()),
    provenance: z.string(),
    explanation: z.string().nullable(),
    updateNote: z.string().nullable(),
    status: z.string(),
  })
  .strict();
export type QuestionVersion = z.infer<typeof QuestionVersion>;

export const HistoryResponse = z.object({ versions: z.array(QuestionVersion) }).strict();
export type HistoryResponse = z.infer<typeof HistoryResponse>;

export const RestoreVersionRequest = z.object({ version: z.number().int().min(1) }).strict();

/** What a permanent deletion takes with it, shown before the owner confirms (FR-09-007). */
export const DeletionImpactResponse = z
  .object({
    versions: z.number().int(),
    pictures: z.number().int(),
    notes: z.number().int(),
    reports: z.number().int(),
  })
  .strict();
export type DeletionImpactResponse = z.infer<typeof DeletionImpactResponse>;

/** A permanent deletion must say so: it is never the result of a stray click. */
export const DeleteQuestionRequest = z.object({ confirm: z.literal(true) }).strict();

export const NoteRequest = z
  .object({
    body: z.string().trim().min(1).max(5000),
    labels: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(10).default([]),
  })
  .strict();

export const NoteView = z
  .object({
    id: z.uuid(),
    questionId: z.uuid(),
    body: z.string(),
    labels: z.array(z.string()),
    createdAt: z.iso.datetime(),
  })
  .strict();
export type NoteView = z.infer<typeof NoteView>;

export const NotesResponse = z.object({ notes: z.array(NoteView) }).strict();
export type NotesResponse = z.infer<typeof NotesResponse>;

const ReportKind = z.enum(['ambiguous', 'image_missing', 'wrong_key', 'other']);

export const ReportRequest = z
  .object({ kind: ReportKind, comment: z.string().trim().max(2000).nullable().default(null) })
  .strict();

export const ReportView = z
  .object({
    id: z.uuid(),
    kind: ReportKind,
    comment: z.string().nullable(),
    createdAt: z.iso.datetime(),
    resolved: z.boolean(),
  })
  .strict();
export type ReportView = z.infer<typeof ReportView>;

export const ReportsResponse = z.object({ reports: z.array(ReportView) }).strict();
export type ReportsResponse = z.infer<typeof ReportsResponse>;

/** Ask the user's AI to fix reading errors in one question (FR-09-005, M7.4). */
export const FixSuggestionRequest = z
  .object({ instanceId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/) })
  .strict();

/**
 * A suggestion the owner compares and may apply; it is never saved on its own. Refused when it
 * changes options, pads the text, changes nothing, or its evidence is not on the page.
 */
export const FixSuggestionResponse = z.discriminatedUnion('outcome', [
  z
    .object({
      outcome: z.literal('suggested'),
      stem: z.string(),
      options: z.array(z.object({ letter: z.string(), text: z.string() })),
      reason: z.string(),
      evidence: z.string(),
    })
    .strict(),
  z
    .object({
      outcome: z.literal('refused'),
      why: z.enum(['no_change', 'changed_options', 'padding', 'unsupported', 'no_page_text']),
    })
    .strict(),
  z.object({ outcome: z.literal('failed'), failure: z.string() }).strict(),
]);
export type FixSuggestionResponse = z.infer<typeof FixSuggestionResponse>;
