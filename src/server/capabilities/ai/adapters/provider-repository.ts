import type { Selectable } from 'kysely';
import type { Db } from '../../../platform/db/index.js';
import type { Database } from '../../../platform/db/schema.js';
import type { ProviderConnection } from '../domain/provider.js';

type Row = Selectable<Database['ai_provider']>;
type Ref = { ownerId: string; id: string };

type Changeable =
  | 'label'
  | 'model'
  | 'baseUrl'
  | 'keyCiphertext'
  | 'keyHint'
  | 'inputPrice'
  | 'outputPrice'
  | 'readinessStatus'
  | 'readinessCheckedAt';

/** Fields left undefined are not changed. */
export type ProviderChanges = { [K in Changeable]?: ProviderConnection[K] | undefined } & {
  updatedAt: Date;
};

/** Owner-scoped store of AI connections; every query filters by owner_id. */
export interface ProviderRepository {
  list(ownerId: string): Promise<ProviderConnection[]>;
  find(ref: Ref): Promise<ProviderConnection | undefined>;
  findDefault(ownerId: string): Promise<ProviderConnection | undefined>;
  insert(connection: ProviderConnection): Promise<void>;
  update(ref: Ref, changes: ProviderChanges): Promise<ProviderConnection | undefined>;
  setDefault(ref: Ref): Promise<boolean>;
  /** Deletes the connection (its sealed key with it); the oldest remaining one becomes default. */
  delete(ref: Ref): Promise<boolean>;
}

const toConnection = (row: Row): ProviderConnection => ({
  id: row.id,
  ownerId: row.owner_id,
  kind: row.kind,
  label: row.label,
  baseUrl: row.base_url,
  model: row.model,
  keyCiphertext: row.key_ciphertext,
  keyHint: row.key_hint,
  inputPrice: row.input_price,
  outputPrice: row.output_price,
  isDefault: row.is_default,
  readinessStatus: row.readiness_status,
  readinessCheckedAt: row.readiness_checked_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toColumns = (changes: ProviderChanges) => ({
  label: changes.label,
  model: changes.model,
  base_url: changes.baseUrl,
  key_ciphertext: changes.keyCiphertext,
  key_hint: changes.keyHint,
  input_price: changes.inputPrice,
  output_price: changes.outputPrice,
  readiness_status: changes.readinessStatus,
  readiness_checked_at: changes.readinessCheckedAt,
  updated_at: changes.updatedAt,
});

const owned = (db: Db, ownerId: string) =>
  db.selectFrom('ai_provider').selectAll().where('owner_id', '=', ownerId);

async function promoteOldest(db: Db, ownerId: string) {
  const oldest = await owned(db, ownerId).orderBy('created_at').limit(1).executeTakeFirst();
  if (!oldest || oldest.is_default) return;
  await db
    .updateTable('ai_provider')
    .set({ is_default: true })
    .where('id', '=', oldest.id)
    .execute();
}

const setDefault = (db: Db, ref: Ref) =>
  db.transaction().execute(async (trx) => {
    const target = await owned(trx, ref.ownerId)
      .where('id', '=', ref.id)
      .forUpdate()
      .executeTakeFirst();
    if (!target) return false;
    await trx
      .updateTable('ai_provider')
      .set({ is_default: false })
      .where('owner_id', '=', ref.ownerId)
      .where('is_default', '=', true)
      .execute();
    await trx
      .updateTable('ai_provider')
      .set({ is_default: true })
      .where('id', '=', ref.id)
      .execute();
    return true;
  });

const deleteAndPromote = (db: Db, ref: Ref) =>
  db.transaction().execute(async (trx) => {
    const result = await trx
      .deleteFrom('ai_provider')
      .where('owner_id', '=', ref.ownerId)
      .where('id', '=', ref.id)
      .executeTakeFirst();
    if (result.numDeletedRows === 0n) return false;
    await promoteOldest(trx, ref.ownerId);
    return true;
  });

export function createProviderRepository(db: Db): ProviderRepository {
  return {
    list: async (ownerId) =>
      (await owned(db, ownerId).orderBy('created_at').execute()).map(toConnection),
    async find(ref) {
      const row = await owned(db, ref.ownerId).where('id', '=', ref.id).executeTakeFirst();
      return row && toConnection(row);
    },
    async findDefault(ownerId) {
      const row = await owned(db, ownerId).where('is_default', '=', true).executeTakeFirst();
      return row && toConnection(row);
    },
    async insert(c) {
      await db
        .insertInto('ai_provider')
        .values({
          ...toColumns(c),
          id: c.id,
          owner_id: c.ownerId,
          kind: c.kind,
          label: c.label,
          model: c.model,
          is_default: c.isDefault,
          created_at: c.createdAt,
        })
        .execute();
    },
    async update(ref, changes) {
      const row = await db
        .updateTable('ai_provider')
        .set(toColumns(changes))
        .where('owner_id', '=', ref.ownerId)
        .where('id', '=', ref.id)
        .returningAll()
        .executeTakeFirst();
      return row && toConnection(row);
    },
    setDefault: (ref) => setDefault(db, ref),
    delete: (ref) => deleteAndPromote(db, ref),
  };
}
