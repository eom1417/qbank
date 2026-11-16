import { promises as fs } from 'node:fs';
import path from 'node:path';
import { FileMigrationProvider, Migrator } from 'kysely/migration';
import { describe, expect, it } from 'vitest';
import { seedCase, storeFigure } from '../support/take.js';
import { useReviewSuite } from '../support/questions.js';
import { bankWith } from '../support/channels.js';

// M34 P1: picture placements and shared cases are additive, checked by the database itself, and
// the migration can be rolled back and applied again.

const suite = useReviewSuite();
const db = () => suite.app.db();

const migrator = () =>
  new Migrator({
    db: db(),
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.resolve('migrations'),
    }),
  });

describe('picture placement and shared cases (M34 P1)', () => {
  it('stores a placement and a case, and keeps older pictures without a placement', async () => {
    const {
      ids: [first = '', second = ''],
    } = await bankWith(suite, 2);
    const unplaced = await storeFigure(db(), first);
    const option = await storeFigure(db(), first, { placement: 'option', optionLetter: 'B' });
    const caseId = await seedCase(db(), [first, second], 'A shared vignette.');
    const rows = await db()
      .selectFrom('media')
      .select(['id', 'placement', 'option_letter'])
      .where('id', 'in', [unplaced, option])
      .execute();
    expect(rows).toEqual(
      expect.arrayContaining([
        { id: unplaced, placement: null, option_letter: null },
        { id: option, placement: 'option', option_letter: 'B' },
      ]),
    );
    const cases = await db()
      .selectFrom('question')
      .select('case_id')
      .where('id', 'in', [first, second])
      .execute();
    expect(cases.map((row) => row.case_id)).toEqual([caseId, caseId]);
  });

  it('refuses an option picture without its letter, a letter elsewhere, or an unknown place', async () => {
    const {
      ids: [question = ''],
    } = await bankWith(suite, 1);
    await expect(storeFigure(db(), question, { placement: 'option' })).rejects.toThrow();
    await expect(
      storeFigure(db(), question, { placement: 'question', optionLetter: 'A' }),
    ).rejects.toThrow();
    const wrong = { placement: 'stem' } as unknown as Parameters<typeof storeFigure>[2];
    await expect(storeFigure(db(), question, wrong)).rejects.toThrow();
  });

  it('rolls back and applies again', async () => {
    const down = await migrator().migrateDown();
    expect(down.error).toBeUndefined();
    expect(down.results?.[0]?.migrationName).toBe('202611261000_m34_placement');
    const up = await migrator().migrateToLatest();
    expect(up.error).toBeUndefined();
    expect(up.results?.map((result) => result.status)).toEqual(['Success']);
  });
});
