// M34 P6 (Q15): the weekly measurement's results. A model whose latest measurement of a lesson
// failed is unapproved for that lesson until a later one passes.
import type { Db } from '../../../platform/db/index.js';

export interface Measurement {
  lesson: string;
  providerKind: string;
  model: string;
  correct: number;
  total: number;
  passed: boolean;
  ranAt: Date;
}

export interface MeasurementRepository {
  record(measurement: Measurement): Promise<void>;
  /** When the last measurement ran, or null when none ever did. */
  lastRun(): Promise<Date | null>;
  /** `lesson\nmodel` of every model whose latest measurement of that lesson failed. */
  revoked(): Promise<Set<string>>;
  /** The AI instance the account's newest pipeline import ran on, or null. */
  instanceOf(ownerId: string): Promise<string | null>;
}

export const revokedKey = (lesson: string, model: string) => `${lesson}\n${model}`;

export function createMeasurementRepository(db: Db, newId: () => string): MeasurementRepository {
  return {
    async record(m) {
      await db
        .insertInto('model_measurement')
        .values({
          id: newId(),
          lesson: m.lesson,
          provider_kind: m.providerKind,
          model: m.model,
          correct: m.correct,
          total: m.total,
          passed: m.passed,
          ran_at: m.ranAt,
        })
        .execute();
    },
    async lastRun() {
      const row = await db
        .selectFrom('model_measurement')
        .select((eb) => eb.fn.max('ran_at').as('last'))
        .executeTakeFirst();
      return row?.last ? new Date(row.last) : null;
    },
    async revoked() {
      const rows = await db
        .selectFrom('model_measurement')
        .select(['lesson', 'model', 'passed'])
        .distinctOn(['lesson', 'model'])
        .orderBy('lesson')
        .orderBy('model')
        .orderBy('ran_at', 'desc')
        .execute();
      return new Set(rows.filter((row) => !row.passed).map((r) => revokedKey(r.lesson, r.model)));
    },
    async instanceOf(ownerId) {
      const row = await db
        .selectFrom('import_job')
        .select('ai_provider_id')
        .where('owner_id', '=', ownerId)
        .where('ai_mode', '=', 'pipeline')
        .where('ai_provider_id', 'is not', null)
        .orderBy('created_at', 'desc')
        .executeTakeFirst();
      return row?.ai_provider_id ?? null;
    },
  };
}
