import { describe, expect, it } from 'vitest';
import { NO_ENHANCEMENTS, type Enhancements } from '../../src/contracts/sources.js';
import { ownerWithBank } from '../support/client.js';
import type { SeedQuestion } from '../support/questions.js';
import { lettered as options, useAiSuite } from '../support/ai-suite.js';

const { app, rowOf, seeded, recheckNow, fakeHost, instance } = useAiSuite();

/** Seeds the questions, runs a re-check with these improvements, and returns their rows. */
async function improve(questions: SeedQuestion[], enhance: Partial<Enhancements>) {
  const { owner, bankId } = await ownerWithBank(app());
  const { ids, sourceId } = await seeded(owner, bankId, questions);
  const { started } = await recheckNow(owner, sourceId, {
    aiProviderId: instance,
    enhance: { ...NO_ENHANCEMENTS, ...enhance },
  });
  expect(started.statusCode).toBe(200);
  return { owner, ids, rows: await Promise.all(ids.map(rowOf)) };
}

const typo = {
  stem: 'What is teh drug of choice for teh condition?',
  options: options('Adrenaline IM', 'Steroids'),
};

describe('organizing only: the AI changes no content (DEC-34)', () => {
  it('keeps every printed word, adds no option, and checks no answer', async () => {
    const asked = fakeHost().asks.length;
    const { rows } = await improve([typo, { ...typo, options: options('One') }], {});
    expect(rows[0]).toMatchObject({
      stem: typo.stem,
      options: typo.options,
      answer_letter: 'B',
      answer_provenance: 'source',
    });
    expect(rows[1]?.options).toHaveLength(1);
    const prompts = fakeHost()
      .asks.slice(asked)
      .map((ask) => ask.body.prompt ?? '');
    expect(prompts.every((prompt) => prompt.startsWith('You organize exam questions'))).toBe(true);
  });
});

describe('improving what the owner chose', () => {
  it('polishes the text and completes options to the chosen number, only where the answer is known', async () => {
    const unknown = {
      ...typo,
      options: options('One'),
      answers: [],
      provenance: 'missing' as const,
    };
    const { owner, ids, rows } = await improve([{ ...typo, options: options('One') }, unknown], {
      polishText: true,
      completeOptions: 5,
    });
    expect(rows[0]?.stem).toBe('What is the drug of choice for the condition?');
    expect(rows[0]?.options).toHaveLength(5);
    expect(rows[1]?.options).toHaveLength(1);
    const shown = (await owner.get(`/api/questions/${ids[0]}`)).json();
    expect(shown.aiChanges).toEqual(expect.arrayContaining(['polished', 'options_added']));
  });

  it('writes a researched topic review for an unclear question, with only live links', async () => {
    const asked = fakeHost().asks.length;
    const unclear = {
      stem: 'Miosis?',
      options: options('Same', 'Also'),
      answers: [],
      provenance: 'missing' as const,
    };
    const { owner, ids, rows } = await improve([unclear, typo], {
      verifyAnswers: true,
      topicReview: true,
    });
    const note = (await owner.get(`/api/questions/${ids[0]}`)).json().studyNote;
    expect(note).toMatchObject({ kind: 'topic_review', researched: true, topic: 'Topic: Miosis?' });
    expect(note.sources).toEqual([
      { title: 'A guideline', url: 'https://guidelines.test/live' },
      { title: 'A dead page', url: null },
    ]);
    expect(rows[1]?.study_note).toBeNull();
    const research = fakeHost()
      .asks.slice(asked)
      .filter((ask) => ask.body.research === true);
    expect(research).toHaveLength(1);
  });
});

describe('an open question the AI would write every option for', () => {
  it('stays open unless the triage settles its answer (no new review)', async () => {
    // The fake writes four short wrong options: three tie, so the solvers never settle it.
    const open = {
      stem: 'Explain the causes of DIC in children.',
      options: [],
      answers: [],
      provenance: 'missing' as const,
      status: 'detected' as const,
    };
    const { rows } = await improve([open], { verifyAnswers: true, completeOptions: 4 });
    expect(rows[0]?.options).toEqual([]);
    expect(rows[0]?.ai_changes).not.toContain('options_added');
  });

  it('stays open even with options found in its text, when nothing gives its answer', async () => {
    const scan = {
      stem: 'Which drug treats it best? a) Drug one b) Drug two c) Drug three',
      options: [],
      answers: [],
      provenance: 'missing' as const,
      status: 'detected' as const,
    };
    const { rows } = await improve([scan], {});
    expect(rows[0]).toMatchObject({ options: [], stem: scan.stem });
  });
});

describe('topic cards (DEC-34)', () => {
  it("lists the bank's questions with a topic review, only to their owner", async () => {
    const unclear = {
      stem: 'DIC causes',
      options: options('Same', 'Also'),
      answers: [],
      provenance: 'missing' as const,
    };
    const { owner, rows } = await improve([unclear, typo], {
      verifyAnswers: true,
      topicReview: true,
    });
    const cards = (await owner.get(`/api/banks/${rows[0]?.bank_id}/topic-cards`)).json().cards;
    expect(cards.map((card: { id: string }) => card.id)).toEqual([rows[0]?.id]);
    expect(cards[0].note).toMatchObject({ kind: 'topic_review', topic: 'Topic: DIC causes' });
    const stranger = await ownerWithBank(app(), 'Other');
    expect(
      (await stranger.owner.get(`/api/banks/${rows[0]?.bank_id}/topic-cards`)).statusCode,
    ).toBe(404);
  });
});

describe('notes on the options', () => {
  it('explains the options of every answered question when chosen, without searching', async () => {
    const { rows } = await improve([typo], { explainOptions: true });
    expect(rows[0]?.study_note).toMatchObject({ kind: 'options', researched: false });
    expect(
      (rows[0]?.study_note as { sources: { url: string | null }[] }).sources.every(
        (s) => s.url === null,
      ),
    ).toBe(true);
  });
});

describe('the additions beyond the question text', () => {
  it("adds an update note for an outdated key, never over the owner's own note", async () => {
    const old = { ...typo, stem: 'Per the old guideline, what is first-line?' };
    const { ids, rows } = await improve([old, old], {});
    expect(rows[0]?.update_note).toBeNull();
    await app
      .db()
      .updateTable('question')
      .set({ update_note: 'Mine.' })
      .where('id', '=', ids[1] ?? '')
      .execute();
    const again = await improve([old], { updateNotes: true });
    expect(again.rows[0]?.update_note).toBe('Current guidance differs (2024).');
  });

  it('rates difficulty and lists questions that ask the same thing', async () => {
    const twin = {
      stem: 'Which drug treats anaphylaxis first in adults?',
      options: options('Adrenaline IM', 'Antihistamine'),
    };
    const other = {
      stem: 'In adults, which drug is first for anaphylaxis treatment?',
      options: options('Antihistamine', 'Adrenaline IM', 'Steroid'),
    };
    const { owner, rows } = await improve([twin, other], { classify: true, duplicates: true });
    expect(rows.map((row) => [row.difficulty, row.difficulty_kind])).toEqual([
      [3, 'inferred'],
      [3, 'inferred'],
    ]);
    const pairs = (await owner.get(`/api/banks/${rows[0]?.bank_id}/duplicates`)).json().pairs;
    expect(pairs).toHaveLength(1);
  });
});
