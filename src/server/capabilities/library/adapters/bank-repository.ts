import type { BankListFilter, UpdateBankRequest } from '../../../../contracts/library.js';
import type { Db } from '../../../platform/db/index.js';
import type { Bank } from '../domain/bank.js';
import { fromBankRow, toBankRow } from './bank-rows.js';

/** Every method is scoped by ownerId: a bank of another account is indistinguishable from none. */
export interface BankRepository {
  insert(bank: Bank): Promise<void>;
  listOwned(ownerId: string, filter: BankListFilter): Promise<Bank[]>;
  findOwned(ownerId: string, id: string): Promise<Bank | undefined>;
  /** Applies changes and returns the updated bank, or undefined when it is not the owner's. */
  update(ownerId: string, id: string, changes: BankChanges): Promise<Bank | undefined>;
  /** Deletes the bank; its chapters, sources and questions go with it (database cascades). */
  delete(ownerId: string, id: string): Promise<boolean>;
}

type BankChanges = UpdateBankRequest & { archivedAt?: Date | null; updatedAt: Date };

export function createBankRepository(db: Db): BankRepository {
  return {
    async insert(bank) {
      await db.insertInto('bank').values(toBankRow(bank)).execute();
    },
    async listOwned(ownerId, { archived }) {
      let query = db.selectFrom('bank').selectAll().where('owner_id', '=', ownerId);
      if (archived === 'exclude') query = query.where('archived_at', 'is', null);
      if (archived === 'only') query = query.where('archived_at', 'is not', null);
      return (await query.execute()).map(fromBankRow);
    },
    async findOwned(ownerId, id) {
      const row = await db
        .selectFrom('bank')
        .selectAll()
        .where('owner_id', '=', ownerId)
        .where('id', '=', id)
        .executeTakeFirst();
      return row && fromBankRow(row);
    },
    async update(ownerId, id, changes) {
      const row = await db
        .updateTable('bank')
        .set({
          name: changes.name,
          description: changes.description,
          subject: changes.subject,
          archived_at: changes.archivedAt,
          updated_at: changes.updatedAt,
        })
        .where('owner_id', '=', ownerId)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();
      return row && fromBankRow(row);
    },
    async delete(ownerId, id) {
      const result = await db
        .deleteFrom('bank')
        .where('owner_id', '=', ownerId)
        .where('id', '=', id)
        .executeTakeFirst();
      return result.numDeletedRows > 0n;
    },
  };
}
