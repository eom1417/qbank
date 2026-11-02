import type { Db } from '../../../platform/db/index.js';
import type { Bank } from '../domain/bank.js';
import { fromBankRow, toBankRow } from './bank-rows.js';

/** Every method is scoped by ownerId: a bank of another account is indistinguishable from none. */
export interface BankRepository {
  insert(bank: Bank): Promise<void>;
  listOwned(ownerId: string): Promise<Bank[]>;
  findOwned(ownerId: string, id: string): Promise<Bank | undefined>;
}

export function createBankRepository(db: Db): BankRepository {
  return {
    async insert(bank) {
      await db.insertInto('bank').values(toBankRow(bank)).execute();
    },
    async listOwned(ownerId) {
      const rows = await db
        .selectFrom('bank')
        .selectAll()
        .where('owner_id', '=', ownerId)
        .execute();
      return rows.map(fromBankRow);
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
  };
}
