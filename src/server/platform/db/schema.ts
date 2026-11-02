import type { ColumnType, Generated } from 'kysely';
import type { ReadinessStatus } from '../../../contracts/ai.js';

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

interface AiProviderTable {
  id: string;
  owner_id: string;
  kind: 'local' | 'openai_compatible';
  label: string;
  base_url: string | null;
  model: string;
  key_ciphertext: string | null;
  key_hint: string | null;
  input_price: number | null;
  output_price: number | null;
  is_default: boolean;
  readiness_status: Generated<ReadinessStatus>;
  readiness_checked_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface AiSettingsTable {
  owner_id: string;
  cost_limit_usd: number | null;
  approval_pages: number;
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
  ai_provider: AiProviderTable;
  ai_settings: AiSettingsTable;
}
