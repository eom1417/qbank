// M34 P3: judged AI steps kept for 7 days, so a resumed import never pays twice (ai_step_cache).
import { createHash } from 'node:crypto';
import { sql } from 'kysely';
import type { Db } from '../../../platform/db/index.js';

export interface StepKeyParts {
  ownerId: string;
  lesson: string;
  lessonVersion: number;
  promptVersion: number;
  model: string;
  /** Which attempt (first, retry with its corrections, strong): a different question each. */
  stage: string;
  fingerprints: readonly string[];
}

/**
 * sha256 of the lesson, its version, the prompt standard, the model, the stage and the item
 * fingerprints in cell order. The owner is part of it so two accounts never share a row.
 */
export function stepKey(parts: StepKeyParts): string {
  const fields = [
    parts.ownerId,
    parts.lesson,
    String(parts.lessonVersion),
    String(parts.promptVersion),
    parts.model,
    parts.stage,
    ...parts.fingerprints,
  ];
  return createHash('sha256').update(JSON.stringify(fields)).digest('hex');
}

export interface CachedStep {
  model: string;
  reply: unknown;
  inputTokens: number;
  outputTokens: number;
}

export interface NewStep extends CachedStep {
  key: string;
  ownerId: string;
  lesson: string;
}

export interface StepCache {
  /** The owner's unexpired step, or null. */
  get(ownerId: string, key: string, now: Date): Promise<CachedStep | null>;
  /** Saves (or refreshes) a step; it expires 7 days later (the column's default). */
  put(step: NewStep): Promise<void>;
  /** Deletes expired steps; returns how many. */
  purgeExpired(now: Date): Promise<number>;
}

export function createStepCache(db: Db): StepCache {
  return {
    async get(ownerId, key, now) {
      const row = await db
        .selectFrom('ai_step_cache')
        .select(['model', 'reply', 'input_tokens', 'output_tokens'])
        .where('key', '=', key)
        .where('owner_id', '=', ownerId)
        .where('expires_at', '>', now)
        .executeTakeFirst();
      if (!row) return null;
      return {
        model: row.model,
        reply: row.reply,
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
      };
    },
    async put(step) {
      const values = {
        key: step.key,
        owner_id: step.ownerId,
        lesson: step.lesson,
        model: step.model,
        reply: JSON.stringify(step.reply),
        input_tokens: step.inputTokens,
        output_tokens: step.outputTokens,
      };
      await db
        .insertInto('ai_step_cache')
        .values(values)
        .onConflict((conflict) =>
          conflict.column('key').doUpdateSet({
            reply: values.reply,
            input_tokens: values.input_tokens,
            output_tokens: values.output_tokens,
            expires_at: sql<Date>`now() + interval '7 days'`,
          }),
        )
        .execute();
    },
    async purgeExpired(now) {
      const result = await db
        .deleteFrom('ai_step_cache')
        .where('expires_at', '<=', now)
        .executeTakeFirst();
      return Number(result.numDeletedRows);
    },
  };
}
