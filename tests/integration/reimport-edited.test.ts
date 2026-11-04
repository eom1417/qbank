import { describe, expect, it } from 'vitest';
import { ownerWithBank } from '../support/client.js';
import { runImports, uploadFile, useImportSuite } from '../support/imports.js';

const { app, fixtures } = useImportSuite();

describe('importing again after editing (FR-10-006, M8.5)', () => {
  it("keeps the owner's text, sets the new reading aside, and lets the owner choose", async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const job = (await uploadFile(app(), owner.cookie(), bankId, fixtures().english)).json();
    await runImports(app());
    const [first, second] = await app
      .db()
      .selectFrom('question')
      .select(['id', 'stem'])
      .where('source_id', '=', job.sourceId)
      .orderBy('source_seq')
      .execute();
    const edited = (await owner.get(`/api/questions/${first?.id}`)).json();
    const mine = 'My corrected wording of this question?';
    await owner.patch(`/api/questions/${first?.id}`, {
      expectedVersion: edited.version,
      stem: mine,
    });
    await owner.post(`/api/imports/${job.id}/retry`, {});
    await runImports(app());
    const kept = (await owner.get(`/api/questions/${first?.id}`)).json();
    expect(kept.stem).toBe(mine);
    expect(kept.reviewReasons).toContain('reimport_differs');
    expect((await owner.get(`/api/questions/${second?.id}`)).json().stem).toBe(second?.stem);
    const taken = (
      await owner.post(`/api/questions/${first?.id}/reimport-choice`, { use: 'new' })
    ).json();
    expect([taken.stem, taken.reviewReasons.includes('reimport_differs')]).toEqual([
      first?.stem,
      false,
    ]);
    const again = await owner.post(`/api/questions/${first?.id}/reimport-choice`, { use: 'mine' });
    expect(again.statusCode).toBe(409);
  });
});
