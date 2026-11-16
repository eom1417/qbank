import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { TakeItemResponse, TakeResultResponse } from '../../src/contracts/take.js';
import { placedFigures, type PlacedFigures } from '../support/channels.js';
import { ownerWithBank } from '../support/client.js';
import { useReviewSuite } from '../support/questions.js';
import {
  movableClock,
  newShare,
  takerOf,
  type PolicyChanges,
  type Taker,
} from '../support/take.js';

const clock = movableClock();
const { app, seed } = useReviewSuite({ clock });
const HOUR = 3_600_000;

/** One question with a picture in every place, shared by a link of `kind`, and its taker. */
async function placedLink(kind: 'exam' | 'practice', changes: PolicyChanges = {}) {
  const { owner, bankId } = await ownerWithBank(app());
  const [questionId = ''] = await seed(owner, bankId, [{ stem: 'Placed?', answers: ['B'] }]);
  const figures = await placedFigures(app.db(), questionId);
  const share = await newShare(owner, bankId, kind, { content: { size: 1 }, ...changes });
  const taker = takerOf(app(), share.token);
  await taker.start({ name: 'Viewer' });
  return { figures, taker };
}

const statusOf = async (taker: Taker, id: string) => (await taker.picture(id)).statusCode;

/** What a person sees of the question before any reveal: never the explanation's picture. */
async function expectQuestionPictures(taker: Taker, figures: PlacedFigures) {
  const item = TakeItemResponse.parse((await taker.item(0)).json());
  expect(item.pictureIds).toEqual([figures.question]);
  expect(item.optionPictureIds).toEqual({ B: [figures.option] });
  expect(item.case).toEqual({ text: figures.caseText, pictures: [figures.caseFigure] });
  for (const id of [figures.question, figures.option, figures.caseFigure])
    expect(await statusOf(taker, id)).toBe(200);
  expect(await statusOf(taker, figures.explanation)).toBe(404);
  expect(await statusOf(taker, figures.unplaced)).toBe(404);
}

const resultPictures = async (taker: Taker) =>
  TakeResultResponse.parse((await taker.result()).json()).items?.[0]?.pictureIds;

describe("an attempt's pictures follow their place (M34)", () => {
  it('shows the explanation picture with practice feedback that explains', async () => {
    const { figures, taker } = await placedLink('practice', {
      reveal: { level: 'explained', when: 'immediately' },
    });
    await expectQuestionPictures(taker, figures);
    const saved = TakeItemResponse.parse((await taker.choose(0, ['B'])).json());
    expect(saved.feedback?.pictureIds).toEqual([figures.explanation]);
    expect(await statusOf(taker, figures.explanation)).toBe(200);
    expect(await statusOf(taker, figures.unplaced)).toBe(404);
    await taker.submit();
    expect(await resultPictures(taker)).toEqual([figures.explanation]);
  });

  it('keeps the explanation picture back when the feedback shows only the answers', async () => {
    const { figures, taker } = await placedLink('practice', {
      reveal: { level: 'answers', when: 'immediately' },
    });
    const saved = TakeItemResponse.parse((await taker.choose(0, ['B'])).json());
    expect(saved.feedback?.pictureIds).toEqual([]);
    await taker.submit();
    expect(await resultPictures(taker)).toEqual([]);
    expect(await statusOf(taker, figures.explanation)).toBe(404);
  });

  it("shows an exam's explanation picture only once its explained result is due", async () => {
    const { figures, taker } = await placedLink('exam', {
      reveal: { level: 'explained', when: 'after_hours', hours: 1 },
    });
    await expectQuestionPictures(taker, figures);
    await taker.choose(0, ['B']);
    await taker.submit();
    expect((await taker.result()).json().items).toBeNull();
    expect(await statusOf(taker, figures.explanation)).toBe(404);
    clock.advance(HOUR);
    expect(await resultPictures(taker)).toEqual([figures.explanation]);
    expect(await statusOf(taker, figures.explanation)).toBe(200);
    expect(await statusOf(taker, figures.unplaced)).toBe(404);
  });
});

describe('an attempt asked before placements (Q65)', () => {
  it('gives out no picture at all, even once it is explained', async () => {
    const { figures, taker } = await placedLink('exam', {
      reveal: { level: 'explained', when: 'immediately' },
    });
    await app
      .db()
      .updateTable('channel_attempt_item')
      .set({ snapshot: sql`snapshot - 'placed'` })
      .execute();
    const item = TakeItemResponse.parse((await taker.item(0)).json());
    expect([item.pictureIds, item.optionPictureIds, item.case]).toEqual([[], {}, null]);
    await taker.choose(0, ['B']);
    await taker.submit();
    expect(await resultPictures(taker)).toEqual([]);
    for (const id of Object.values(figures).filter((v) => v !== figures.caseText))
      expect(await statusOf(taker, id)).toBe(404);
  });
});
