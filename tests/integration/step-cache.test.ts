import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import {
  createStepCache,
  stepKey,
} from '../../src/server/capabilities/sources/adapters/step-cache.js';
import { registeredBrowser } from '../support/client.js';
import { useTestApp } from '../support/test-app.js';

// M34 P3: judged AI steps are kept per owner for 7 days and never paid twice.

const app = useTestApp();
const cache = () => createStepCache(app.db());

async function newOwner(): Promise<string> {
  const { payload } = await registeredBrowser(app());
  const row = await app
    .db()
    .selectFrom('account')
    .select('id')
    .where('email', '=', payload.email)
    .executeTakeFirstOrThrow();
  return row.id;
}

const keyFor = (ownerId: string, fingerprints = ['a', 'b']) =>
  stepKey({
    ownerId,
    lesson: 'D4.mark',
    lessonVersion: 1,
    promptVersion: 1,
    model: 'claude-haiku-5-5',
    stage: 'first',
    fingerprints,
  });

const step = (ownerId: string, key: string, option = 'A') => ({
  key,
  ownerId,
  lesson: 'D4.mark',
  model: 'claude-haiku-5-5',
  reply: { items: [{ n: 1, option }] },
  inputTokens: 140,
  outputTokens: 30,
});

/** Two steps of a new owner, the first already past its 7 days. */
async function oneExpired(names: [string, string]) {
  const owner = await newOwner();
  const [old, fresh] = [keyFor(owner, [names[0]]), keyFor(owner, [names[1]])];
  await cache().put(step(owner, old));
  await cache().put(step(owner, fresh));
  await app
    .db()
    .updateTable('ai_step_cache')
    .set({ expires_at: sql<Date>`now() - interval '1 minute'` })
    .where('key', '=', old)
    .execute();
  return { owner, old, fresh };
}

describe('the AI step cache (M34 P3)', () => {
  it('returns a saved step to its owner only, and refreshes it on a second save', async () => {
    const [owner, other] = [await newOwner(), await newOwner()];
    const key = keyFor(owner);
    expect(await cache().get(owner, key, new Date())).toBeNull();
    await cache().put(step(owner, key));
    await cache().put(step(owner, key, 'B'));
    expect(await cache().get(owner, key, new Date())).toEqual({
      model: 'claude-haiku-5-5',
      reply: { items: [{ n: 1, option: 'B' }] },
      inputTokens: 140,
      outputTokens: 30,
    });
    expect(await cache().get(other, key, new Date())).toBeNull();
    expect(keyFor(other)).not.toBe(key);
    expect(keyFor(owner, ['b', 'a'])).not.toBe(key);
  });

  it('expires after 7 days and purges only expired steps', async () => {
    const { owner, old, fresh } = await oneExpired(['old', 'fresh']);
    expect(await cache().get(owner, old, new Date())).toBeNull();
    const inEightDays = new Date(Date.now() + 8 * 86_400_000);
    expect(await cache().get(owner, fresh, inEightDays)).toBeNull();
    expect(await cache().purgeExpired(new Date())).toBe(1);
    expect(await cache().get(owner, fresh, new Date())).not.toBeNull();
  });
});

describe('the AI step cache and the import worker (Q23)', () => {
  it('is purged by the import worker once expired, with nothing else of the owner (Q23)', async () => {
    const { owner, fresh } = await oneExpired(['worker-old', 'worker-fresh']);
    await app().importWorker.drain();
    const kept = await app
      .db()
      .selectFrom('ai_step_cache')
      .select('key')
      .where('owner_id', '=', owner)
      .execute();
    expect(kept.map((row) => row.key)).toEqual([fresh]);
  });
});
