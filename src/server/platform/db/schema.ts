import type { ColumnType, Generated } from 'kysely';

type CreatedAt = ColumnType<Date, Date | undefined, never>;

interface AccountTable {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  locale: 'ar' | 'en';
  theme: Generated<'system' | 'light' | 'dark'>;
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

export interface Database {
  account: AccountTable;
  auth_session: AuthSessionTable;
  bank: BankTable;
}
