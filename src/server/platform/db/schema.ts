import type { ColumnType, Generated } from 'kysely';

type CreatedAt = ColumnType<Date, Date | undefined, never>;

interface AccountTable {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  locale: 'ar' | 'en';
  theme: Generated<'system' | 'light' | 'dark'>;
  /** Checked by the contract, not the database, so a new skin needs no migration. */
  skin: Generated<string>;
  default_session_size: Generated<number>;
  explanation_mode: Generated<'after_answer' | 'on_request'>;
  review_reminders: Generated<'off' | 'daily' | 'weekly'>;
  terms_accepted_at: Date;
  created_at: CreatedAt;
}

interface AuthSessionTable {
  token_hash: string;
  account_id: string;
  created_at: CreatedAt;
  expires_at: Date;
}

export interface BankTable {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  subject: string | null;
  archived_at: Date | null;
  created_at: CreatedAt;
  updated_at: Date;
}

interface PasswordResetTable {
  token_hash: string;
  account_id: string;
  created_at: CreatedAt;
  expires_at: Date;
  used_at: Date | null;
}

interface MailOutboxTable {
  id: string;
  to_address: string;
  subject: string;
  body_text: string;
  created_at: CreatedAt;
}

interface ChapterTable {
  id: string;
  owner_id: string;
  bank_id: string;
  name: string;
  position: number;
  created_at: Date;
}

interface TopicTable {
  id: string;
  owner_id: string;
  chapter_id: string;
  name: string;
  created_at: Date;
}

interface TagTable {
  id: string;
  owner_id: string;
  name: string;
  created_at: Date;
}

export type ImportStage =
  | 'queued'
  | 'reading'
  | 'extracting'
  | 'verifying'
  | 'matching'
  | 'completed'
  | 'needs_review'
  | 'partial_failure'
  | 'failed'
  | 'cancelled';

interface SourceTable {
  id: string;
  owner_id: string;
  bank_id: string;
  file_name: string;
  byte_size: ColumnType<string, number, never>;
  sha256: string;
  blob_key: string | null;
  page_count: number;
  page_from: number;
  page_to: number;
  language: 'auto' | 'ar' | 'en' | 'mixed';
  source_type: string;
  created_at: Date;
  /** An answer-key file names the source whose questions it answers (M6.3). */
  answers_for_source_id: ColumnType<string | null, string | null | undefined, string | null>;
  /** When the stored original is erased on its own (DEC-13); null keeps it. */
  original_expires_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
}

interface ImportJobTable {
  id: string;
  owner_id: string;
  source_id: string;
  stage: ImportStage;
  pages_total: number;
  pages_done: Generated<number>;
  questions_found: Generated<number>;
  questions_review: Generated<number>;
  ai_provider_id: string | null;
  /** The model chosen for that instance; its default when null. */
  ai_model: Generated<string | null>;
  /** 'verify': the AI checks open answers; 'read': it reads whole pages. */
  ai_mode: Generated<'verify' | 'read' | 'recheck'>;
  /** What the AI improves (`Enhancements`, DEC-34); null without AI. */
  ai_enhance: ColumnType<unknown, string | null | undefined, string>;
  /** The model of each triage role (`TriageModels`), or null for the instance default. */
  ai_roles: ColumnType<unknown, string | null | undefined, string>;
  ai_outcome: string | null;
  error_code: string | null;
  attempts: Generated<number>;
  locked_until: Date | null;
  created_at: Date;
  updated_at: Date;
  finished_at: Date | null;
}

interface ImportPageTable {
  job_id: string;
  page_no: number;
  status: 'done' | 'unreadable' | 'failed';
  reading: 'text' | 'ocr';
  content: ColumnType<unknown, string, string>;
  warning: string | null;
}

interface QuestionTable {
  id: string;
  owner_id: string;
  bank_id: string;
  source_id: string;
  source_page: number;
  source_number: number;
  kind: 'mcq' | 'essay';
  stem: string;
  options: ColumnType<unknown, string, string>;
  answer_letter: string | null;
  answer_provenance: 'source' | 'manual' | 'ai_suggested' | 'ai_verified' | 'conflict' | 'missing';
  /** The file's own answer, kept when the AI overturned it (DEC-16). */
  file_answer: ColumnType<string | null, string | null | undefined, string | null>;
  /** The triage's deciding reason (DEC-33). */
  ai_note: ColumnType<string | null, string | null | undefined, string | null>;
  /** What the AI changed (`polished`, `options_added`, …), shown as badges (DEC-34). */
  ai_changes: ColumnType<string[], string[] | undefined, string[]>;
  /** The AI's study note (`StudyNote`), apart from the book's explanation. */
  study_note: ColumnType<unknown, string | null | undefined, string | null>;
  answer_evidence: string | null;
  status: 'detected' | 'needs_review' | 'eligible' | 'excluded' | 'archived';
  review_reasons: ColumnType<string[], string[] | undefined, string[]>;
  created_at: Date;
  updated_at: Date;
  answer_letters: ColumnType<string[], string[] | undefined, string[]>;
  multi_select: ColumnType<boolean, boolean | undefined, boolean>;
  explanation: ColumnType<string | null, string | null | undefined, string | null>;
  chapter_id: ColumnType<string | null, string | null | undefined, string | null>;
  topic_id: ColumnType<string | null, string | null | undefined, string | null>;
  classification: ColumnType<'none' | 'suggested' | 'manual', string | undefined, string>;
  difficulty_kind: ColumnType<'unset' | 'manual' | 'inferred', string | undefined, string>;
  difficulty: ColumnType<number | null, number | null | undefined, number | null>;
  ai_answer_accepted_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  version: ColumnType<number, number | undefined, number>;
  source_occurrence: ColumnType<number, number | undefined, number>;
  source_seq: ColumnType<number, number | undefined, number>;
  /** The owner left it for later (M7.3); it stays in review, listed after the rest. */
  deferred_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  /** Newer medical information, kept apart from the book's answer (FR-24-002, DEC-16). */
  update_note: ColumnType<string | null, string | null | undefined, string | null>;
  /** The owner changed its text (M7): a re-import never overwrites it (FR-10-006). */
  owner_edited_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  /** A re-import's different reading of an edited question, for the owner to compare. */
  reimport_text: ColumnType<unknown, string | null | undefined, string | null>;
  /** A copy made into another bank (FR-03-009); re-imports of its source leave it alone. */
  copied_from: ColumnType<string | null, string | null | undefined, string | null>;
  /** The question the owner chose as the reference for this duplicate (FR-10-004). */
  duplicate_of: ColumnType<string | null, string | null | undefined, string | null>;
}

interface QuestionPairTable {
  id: string;
  owner_id: string;
  bank_id: string;
  question_a: string;
  question_b: string;
  kind: 'exact' | 'similar';
  similarity: number;
  differences: ColumnType<string[], string[] | undefined, string[]>;
  decision: 'kept_both' | 'reference' | 'excluded' | null;
  decided_at: Date | null;
  created_at: Date;
}

interface QuestionNoteTable {
  id: string;
  owner_id: string;
  question_id: string;
  body: string;
  labels: ColumnType<string[], string[] | undefined, string[]>;
  created_at: Date;
}

interface QuestionReportTable {
  id: string;
  owner_id: string;
  question_id: string;
  kind: 'ambiguous' | 'image_missing' | 'wrong_key' | 'other';
  comment: string | null;
  created_at: Date;
  resolved_at: Date | null;
}

interface QuestionTagTable {
  question_id: string;
  tag_id: string;
  owner_id: string;
  origin: 'suggested' | 'manual';
}

interface QuestionVersionTable {
  question_id: string;
  version: number;
  owner_id: string;
  snapshot: ColumnType<unknown, string, string>;
  origin: string;
  created_at: Date;
}

interface MediaTable {
  id: string;
  owner_id: string;
  source_id: string;
  question_id: string;
  position: number;
  page: number;
  box: ColumnType<unknown, string, string>;
  kind: 'figure' | 'table';
  modality: string | null;
  link: 'certain' | 'uncertain';
  blob_key: string;
  width: number;
  height: number;
  quality: ColumnType<unknown, string, string>;
  low_quality: boolean;
  created_at: Date;
}

export type StudyKind =
  'random' | 'new' | 'wrong' | 'due' | 'flagged' | 'retry' | 'weak' | 'smart_mix';

interface StudySessionTable {
  id: string;
  owner_id: string;
  mode: 'tutor' | 'exam';
  kind: StudyKind;
  scope: ColumnType<unknown, string, string>;
  size: number;
  status: 'active' | 'finished';
  position: ColumnType<number, number | undefined, number>;
  created_at: Date;
  updated_at: Date;
  finished_at: Date | null;
  timing: ColumnType<'none' | 'total' | 'per_question', string | undefined, string>;
  timing_seconds: ColumnType<number | null, number | null | undefined, number | null>;
  /** A total-time exam ends here, by the server's clock (FR-13-011). */
  deadline_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  ended_by: ColumnType<'owner' | 'time' | null, string | null | undefined, string | null>;
}

interface StudyItemTable {
  session_id: string;
  position: number;
  owner_id: string;
  question_id: string | null;
  snapshot: ColumnType<unknown, string, string>;
  chosen: string[] | null;
  correct: boolean | null;
  seconds: number | null;
  answered_at: Date | null;
  flagged: ColumnType<boolean, boolean | undefined, boolean>;
  /** An exam answer saved on change; graded only at submission (FR-13-007). */
  saved_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  /** When a per-question-timed item was first shown (FR-13-004). */
  opened_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
}

interface QuestionMarkTable {
  owner_id: string;
  question_id: string;
  flagged: boolean;
  favorite: boolean;
  updated_at: Date;
}

export interface Database {
  account: AccountTable;
  auth_session: AuthSessionTable;
  bank: BankTable;
  password_reset: PasswordResetTable;
  mail_outbox: MailOutboxTable;
  chapter: ChapterTable;
  topic: TopicTable;
  tag: TagTable;
  source: SourceTable;
  import_job: ImportJobTable;
  import_page: ImportPageTable;
  question: QuestionTable;
  media: MediaTable;
  question_version: QuestionVersionTable;
  question_tag: QuestionTagTable;
  question_note: QuestionNoteTable;
  question_report: QuestionReportTable;
  question_pair: QuestionPairTable;
  study_session: StudySessionTable;
  study_item: StudyItemTable;
  question_mark: QuestionMarkTable;
}
