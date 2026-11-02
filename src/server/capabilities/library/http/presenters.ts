import type { BankResponse } from '../../../../contracts/library.js';
import type { Bank } from '../domain/bank.js';

export const toBankResponse = (bank: Bank): BankResponse => ({
  id: bank.id,
  name: bank.name,
  description: bank.description,
  subject: bank.subject,
  archived: bank.archivedAt !== null,
  createdAt: bank.createdAt.toISOString(),
  updatedAt: bank.updatedAt.toISOString(),
});
