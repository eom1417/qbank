import type { ColumnType, Generated } from 'kysely';

type CreatedAt = ColumnType<Date, Date | undefined, never>;

interface AccountTable {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  locale: 'ar' | 'en';
  theme: Generated<'system' | 'light' | 'dark'>;
  default_session_size: Generated<number>;
  explanation_mode: Generated<'after_answer' | 'on_request'>;
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
  answer_provenance: 'source' | 'manual' | 'ai_suggested' | 'conflict' | 'missing';
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
}
