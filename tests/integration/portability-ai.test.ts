import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { NO_ENHANCEMENTS } from '../../src/contracts/sources.js';
import { lettered as options, useAiSuite } from '../support/ai-suite.js';
import { ownerWithBank } from '../support/client.js';
import { exportZip, restoreZip } from '../support/imports.js';

const { app, seeded, recheckNow, rowOf, instance } = useAiSuite();

describe("an export keeps the AI's work (DEC-34)", () => {
  it('restores the study note and what the AI changed, so topic cards come back too', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const unclear = {
      stem: 'DIC causes',
      options: options('Same', 'Also'),
      answers: [],
      provenance: 'missing' as const,
    };
    const { ids, sourceId } = await seeded(owner, bankId, [unclear]);
    await recheckNow(owner, sourceId, {
      aiProviderId: instance,
      enhance: { ...NO_ENHANCEMENTS, verifyAnswers: true, topicReview: true },
    });
    await app
      .db()
      .updateTable('question')
      .set({
        file_answer: 'B',
        ai_note: 'Both solvers chose A',
        difficulty: 4,
        difficulty_kind: 'manual',
      })
      .where('id', '=', ids[0] ?? '')
      .execute();
    const before = await rowOf(ids[0] ?? '');
    expect(before.study_note).not.toBeNull();
    const { response } = await exportZip(app(), owner.cookie(), bankId);
    const restored = await restoreZip(app(), owner.cookie(), new Uint8Array(response.rawPayload));
    const newBank = restored.json().bankId;
    const cards = (await owner.get(`/api/banks/${newBank}/topic-cards`)).json().cards;
    expect(cards).toHaveLength(1);
    expect(cards[0].note).toEqual(before.study_note);
    const copy = await rowOf(cards[0].id);
    const kept = ['ai_changes', 'file_answer', 'ai_note', 'difficulty', 'difficulty_kind'] as const;
    for (const column of kept) expect(copy[column]).toEqual(before[column]);
  });
});

describe('restoring older or altered files', () => {
  it('still restores a file made before M20, with no note and no changes', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await seeded(owner, bankId, [{ stem: 'Old question', options: options('One', 'Two') }]);
    const { files } = await exportZip(app(), owner.cookie(), bankId);
    const file = JSON.parse(new TextDecoder().decode(files['qbank-export.json']));
    for (const q of file.questions) {
      delete q.studyNote;
      delete q.aiChanges;
    }
    const old = zipSync({ 'qbank-export.json': new TextEncoder().encode(JSON.stringify(file)) });
    const restored = await restoreZip(app(), owner.cookie(), old);
    expect([restored.statusCode, restored.json().questions]).toEqual([201, 1]);
  });

  it('refuses a file whose change badges are not plain names', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await seeded(owner, bankId, [{ stem: 'Old question', options: options('One', 'Two') }]);
    const { files } = await exportZip(app(), owner.cookie(), bankId);
    const file = JSON.parse(new TextDecoder().decode(files['qbank-export.json']));
    file.questions[0].aiChanges = ['<script>'];
    const bad = zipSync({ 'qbank-export.json': new TextEncoder().encode(JSON.stringify(file)) });
    expect((await restoreZip(app(), owner.cookie(), bad)).json().error.code).toBe(
      'file_unsupported',
    );
  });
});
