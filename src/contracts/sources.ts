import { z } from 'zod';
import { KitInstanceId, KitModel } from './providers.js';

/** The kit's ProviderInstanceId: letters, digits, dashes and underscores. */

export const SourceLanguage = z.enum(['auto', 'ar', 'en', 'mixed']);
export type SourceLanguage = z.infer<typeof SourceLanguage>;

/** What kind of material the file is (FR-04-005); optional, it helps the report. */
export const SourceType = z.enum([
  'question_bank',
  'past_exam',
  'textbook',
  'lecture_notes',
  'other',
  /** A file with only the answers to another source's questions (M6.3). */
  'answer_key',
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
    /** A provider instance of the AI providers kit, such as `codex` (DEC-30). */
    aiProviderId: KitInstanceId.optional(),
    /** That instance's model for this import; its default when omitted. */
    aiModel: KitModel.optional(),
    /** How the AI helps: checks the answers the rules left open, or reads whole pages. */
    aiMode: z.enum(['verify', 'read']).default('verify'),
    /** What the AI improves beyond organizing the file (DEC-34); nothing when omitted. */
    aiEnhance: z.string().max(1000).optional(),
    /** The model of each triage role (DEC-33); the instance's model or default when omitted. */
    aiFirstModel: KitModel.optional(),
    aiSecondModel: KitModel.optional(),
    aiJudgeModel: KitModel.optional(),
    aiImproverModel: KitModel.optional(),
    /** With source type `answer_key`: the source whose questions this file answers (M6.3). */
    answersFor: z.uuid().optional(),
    /** The user approved an AI cost estimate above their limits (DEC-18). */
    aiApproved: z.enum(['true', 'false']).default('false'),
  })
  .strict()
  .refine((value) => !value.pageFrom || !value.pageTo || value.pageFrom <= value.pageTo, {
    path: ['pageTo'],
    message: 'too_small',
  });
export type StartImportFields = z.infer<typeof StartImportFields>;

/**
 * "Improve questions with AI" (DEC-34): each part is chosen on its own. Without any of them the
 * AI only organizes the file (finds, splits, links answers) and keeps every word as printed.
 */
export const Enhancements = z
  .object({
    /** Two blind solvers and a judge settle every answer (DEC-33). */
    verifyAnswers: z.boolean(),
    /** Questions with fewer options get plausible wrong ones up to this many; 0 is off. */
    completeOptions: z.union([z.literal(0), z.literal(3), z.literal(4), z.literal(5)]),
    /** Spelling, grammar and clarity, never what is asked (guarded). */
    polishText: z.boolean(),
    /** A topic review with real sources for incomplete or unclear questions. */
    topicReview: z.boolean(),
    /** A short note on why each option is right or wrong, for every question. */
    explainOptions: z.boolean(),
    /** A separate note when the book's answer follows an older guideline (DEC-16). */
    updateNotes: z.boolean(),
    /** Chapter, topic and difficulty suggestions. */
    classify: z.boolean(),
    /** Questions that ask the same thing in other words, across the bank. */
    duplicates: z.boolean(),
  })
  .strict();
export type Enhancements = z.infer<typeof Enhancements>;

/** What the owner chose by default (DEC-34). */
export const DEFAULT_ENHANCEMENTS: Enhancements = {
  verifyAnswers: true,
  completeOptions: 4,
  polishText: true,
  topicReview: true,
  explainOptions: false,
  updateNotes: false,
  classify: false,
  duplicates: false,
};

/** Organizing only: the AI changes no content. */
export const NO_ENHANCEMENTS: Enhancements = {
  verifyAnswers: false,
  completeOptions: 0,
  polishText: false,
  topicReview: false,
  explainOptions: false,
  updateNotes: false,
  classify: false,
  duplicates: false,
};

/** An upload's enhancements, sent as one JSON form field: none when absent, null when invalid. */
export function enhancementsOf(field: string | undefined): Enhancements | null {
  if (field === undefined) return NO_ENHANCEMENTS;
  try {
    const parsed = Enhancements.safeParse(JSON.parse(field));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The model of each triage role, as an import job keeps it (DEC-33). */
export const TriageModels = z
  .object({
    first: KitModel.optional(),
    second: KitModel.optional(),
    judge: KitModel.optional(),
    improver: KitModel.optional(),
  })
  .strict();
export type TriageModels = z.infer<typeof TriageModels>;

/**
 * `POST /api/sources/:id/recheck`: the AI triages the source's saved questions again (DEC-33),
 * as a background job whose report is the import report.
 */
export const RecheckRequest = z
  .object({
    aiProviderId: KitInstanceId,
    aiModel: KitModel.optional(),
    /** Organizing only when omitted. */
    enhance: Enhancements.default(NO_ENHANCEMENTS),
    models: TriageModels.default({}),
  })
  .strict();
export type RecheckRequest = z.infer<typeof RecheckRequest>;

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
    /** The AI the job ran on (DEC-33): instance, its model, improvement and each role's model. */
    ai: z
      .object({
        instanceId: z.string(),
        model: z.string().nullable(),
        enhance: Enhancements,
        models: TriageModels,
      })
      .strict()
      .nullable(),
    createdAt: z.iso.datetime(),
    finishedAt: z.iso.datetime().nullable(),
    /** Pages that were read by OCR, unreadable, or failed; every other page was read cleanly. */
    pages: z.array(ImportPageReport),
  })
  .strict();
export type ImportResponse = z.infer<typeof ImportResponse>;

export const RetryImportRequest = z
  .object({
    aiProviderId: KitInstanceId.nullable().optional(),
    aiModel: KitModel.nullable().optional(),
    aiApproved: z.boolean().optional(),
  })
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
    questions: z
      .object({
        total: z.number().int(),
        needsReview: z.number().int(),
        /** Ready to study (FR-11-001): an answer from the source, nothing left to review. */
        eligible: z.number().int(),
      })
      .strict(),
    /** For an answer-key file: the source whose questions it answers (M6.3). */
    answersFor: z.uuid().nullable(),
    latestImport: z.object({ id: z.uuid(), stage: ImportStage }).strict(),
    /** The uploaded original is still kept; the user may delete it (FR-19-001, DEC-13). */
    hasOriginal: z.boolean(),
    /** When the original is erased on its own (DEC-13); null while it is kept. */
    originalExpiresAt: z.iso.datetime().nullable(),
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

/** Imports that ended lately, for the in-app notice (FR-22-003): partial is said as partial. */
export const RecentImportsResponse = z
  .object({
    imports: z.array(
      z
        .object({
          id: z.uuid(),
          bankId: z.uuid(),
          fileName: z.string(),
          stage: z.string(),
          questionsFound: z.number().int(),
          needsReview: z.number().int(),
          finishedAt: z.iso.datetime(),
        })
        .strict(),
    ),
  })
  .strict();
export type RecentImportsResponse = z.infer<typeof RecentImportsResponse>;
