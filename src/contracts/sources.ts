import { z } from 'zod';

export const SourceLanguage = z.enum(['auto', 'ar', 'en', 'mixed']);
export type SourceLanguage = z.infer<typeof SourceLanguage>;

/** What kind of material the file is (FR-04-005); optional, it helps the report. */
export const SourceType = z.enum([
  'question_bank',
  'past_exam',
  'textbook',
  'lecture_notes',
  'other',
]);
export type SourceType = z.infer<typeof SourceType>;

/** The stages an import goes through, in order, and how it ends (FR-04-009). */
const ImportStage = z.enum([
  'queued',
  'reading',
  'extracting',
  'verifying',
  'matching',
  'completed',
  'needs_review',
  'partial_failure',
  'failed',
  'cancelled',
]);

const PageNumber = z.coerce.number().int().min(1).max(10_000);

/**
 * The form fields sent with each uploaded file (multipart, before the file part). The user must
 * confirm they may use the file (FR-04-007); AI is optional and uses their own connection.
 */
export const StartImportFields = z
  .object({
    pageFrom: PageNumber.optional(),
    pageTo: PageNumber.optional(),
    language: SourceLanguage.default('auto'),
    sourceType: SourceType.default('question_bank'),
    rightsConfirmed: z.literal('true'),
    aiProviderId: z.uuid().optional(),
    /** The user approved an AI cost estimate above their limits (DEC-18). */
    aiApproved: z.enum(['true', 'false']).default('false'),
  })
  .strict()
  .refine((value) => !value.pageFrom || !value.pageTo || value.pageFrom <= value.pageTo, {
    path: ['pageTo'],
    message: 'too_small',
  });
export type StartImportFields = z.infer<typeof StartImportFields>;

const ImportPageReport = z
  .object({
    page: z.number().int(),
    status: z.enum(['done', 'unreadable', 'failed']),
    reading: z.enum(['text', 'ocr']),
    /** `ocr` (read from the image), `unreadable_page` or `read_failed`. */
    warning: z.string().nullable(),
  })
  .strict();

/** One file's import and its report (FR-04-011, UI-08, UI-09). Counts are real, never estimated. */
export const ImportResponse = z
  .object({
    id: z.uuid(),
    sourceId: z.uuid(),
    bankId: z.uuid(),
    fileName: z.string(),
    stage: ImportStage,
    pagesTotal: z.number().int(),
    pagesDone: z.number().int(),
    questionsFound: z.number().int(),
    questionsReview: z.number().int(),
    /** What the AI step did: `not_used`, `done`, or why it stopped (`invalid_key`, …). */
    aiOutcome: z.string().nullable(),
    errorCode: z.string().nullable(),
    createdAt: z.iso.datetime(),
    finishedAt: z.iso.datetime().nullable(),
    /** Pages that were read by OCR, unreadable, or failed; every other page was read cleanly. */
    pages: z.array(ImportPageReport),
  })
  .strict();
export type ImportResponse = z.infer<typeof ImportResponse>;

export const RetryImportRequest = z
  .object({ aiProviderId: z.uuid().nullable().optional(), aiApproved: z.boolean().optional() })
  .strict();
export type RetryImportRequest = z.infer<typeof RetryImportRequest>;

/** A source in a bank (UI-23): the file, what was read, and its latest import. */
const SourceResponse = z
  .object({
    id: z.uuid(),
    bankId: z.uuid(),
    fileName: z.string(),
    pageCount: z.number().int(),
    pageFrom: z.number().int(),
    pageTo: z.number().int(),
    language: SourceLanguage,
    sourceType: SourceType,
    createdAt: z.iso.datetime(),
    questions: z.object({ total: z.number().int(), needsReview: z.number().int() }).strict(),
    latestImport: z.object({ id: z.uuid(), stage: ImportStage }).strict(),
    /** The uploaded original is still kept; the user may delete it (FR-19-001, DEC-13). */
    hasOriginal: z.boolean(),
  })
  .strict();

export const SourceListResponse = z.object({ sources: z.array(SourceResponse) }).strict();
export type SourceListResponse = z.infer<typeof SourceListResponse>;

/** A picture kept for a question (M5): what it is, how sure the link is, and its quality. */
const MediaResponse = z
  .object({
    id: z.uuid(),
    questionNumber: z.number().int(),
    page: z.number().int(),
    position: z.number().int(),
    kind: z.enum(['figure', 'table']),
    /** Named only from the question's stem (FR-06-007): ecg, xray, ct, mri, ultrasound… */
    modality: z.string().nullable(),
    /** `uncertain`: placed between questions; the user confirms it in review (UAT-027). */
    link: z.enum(['certain', 'uncertain']),
    lowQuality: z.boolean(),
    width: z.number().int(),
    height: z.number().int(),
  })
  .strict();

export const MediaListResponse = z.object({ media: z.array(MediaResponse) }).strict();
export type MediaListResponse = z.infer<typeof MediaListResponse>;
