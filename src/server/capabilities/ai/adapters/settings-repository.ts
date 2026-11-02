import type { AiSettings } from '../../../../contracts/ai.js';
import type { Db } from '../../../platform/db/index.js';

/** Per-account AI limits (DEC-18); no row means the defaults apply. */
export interface AiSettingsRepository {
  get(ownerId: string): Promise<AiSettings | undefined>;
  save(ownerId: string, settings: AiSettings): Promise<void>;
}

export function createAiSettingsRepository(db: Db): AiSettingsRepository {
  return {
    async get(ownerId) {
      const row = await db
        .selectFrom('ai_settings')
        .select(['cost_limit_usd', 'approval_pages'])
        .where('owner_id', '=', ownerId)
        .executeTakeFirst();
      return row && { costLimitUsd: row.cost_limit_usd, approvalPages: row.approval_pages };
    },
    async save(ownerId, settings) {
      const columns = {
        cost_limit_usd: settings.costLimitUsd,
        approval_pages: settings.approvalPages,
      };
      await db
        .insertInto('ai_settings')
        .values({ owner_id: ownerId, ...columns })
        .onConflict((conflict) => conflict.column('owner_id').doUpdateSet(columns))
        .execute();
    },
  };
}
