import type { Insertable, Selectable } from 'kysely';
import type { BankTable } from '../../../platform/db/schema.js';
import type { Bank } from '../domain/bank.js';

/** Mapping between the `bank` table and the Bank domain type (one place for column names). */
export const fromBankRow = (row: Selectable<BankTable>): Bank => ({
  id: row.id,
  ownerId: row.owner_id,
  name: row.name,
  description: row.description,
  subject: row.subject,
  archivedAt: row.archived_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toBankRow = (bank: Bank): Insertable<BankTable> => ({
  id: bank.id,
  owner_id: bank.ownerId,
  name: bank.name,
  description: bank.description,
  subject: bank.subject,
  archived_at: bank.archivedAt,
  created_at: bank.createdAt,
  updated_at: bank.updatedAt,
});
