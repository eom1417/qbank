import { describe, expect, it } from 'vitest';
import { BatchAnswersResponse, BatchResponse } from '../../src/contracts/channels.js';
import { agentOf, newChannel, newShare, placedFigures } from '../support/channels.js';
import { ownerWithBank } from '../support/client.js';
import { useReviewSuite } from '../support/questions.js';
import { movableClock, seedCase, storeFigure } from '../support/take.js';

const clock = movableClock();
const { app, seed } = useReviewSuite({ clock });
const HOUR = 3_600_000;
const url = (id: string) => `/api/channel/v1/pictures/${id}`;

/** One ready question with a picture in every place, on an agent share revealing in an hour. */
async function placedChannel(level: 'answers' | 'explained' = 'explained') {
  const { owner, bankId } = await ownerWithBank(app());
  const [questionId = ''] = await seed(owner, bankId, [{ stem: 'Placed?', answers: ['B'] }]);
  const figures = await placedFigures(app.db(), questionId);
  const reveal = { level, when: 'after_hours' as const, hours: 1 };
  const { key } = await newShare(owner, bankId, 'agent', { reveal });
  return { key, figures, agent: agentOf(app(), key) };
}

const statusOf = async (agent: ReturnType<typeof agentOf>, id: string) =>
  (await agent.picture(id)).statusCode;

/** The MCP transport: one tool call, its JSON answer. */
async function mcpCall(key: string, name: string, args: object) {
  const response = await agentOf(app(), key).tool(name, args);
  return JSON.parse(response.json().result.content[0].text);
}

describe("a channel's pictures follow their place (M34)", () => {
  it("sends the question's, option's and case's pictures with the batch, never the explanation's", async () => {
    const { figures, agent } = await placedChannel();
    const batch = BatchResponse.parse((await agent.batch()).json());
    const [question] = batch.questions;
    expect(question?.pictures).toEqual([url(figures.question)]);
    expect(question?.optionPictures).toEqual({ B: [url(figures.option)] });
    expect(question?.case).toEqual({
      text: figures.caseText,
      pictures: [url(figures.caseFigure)],
    });
    for (const id of [figures.question, figures.option, figures.caseFigure])
      expect(await statusOf(agent, id)).toBe(200);
    expect(JSON.stringify(batch)).not.toContain(figures.explanation);
    expect(JSON.stringify(batch)).not.toContain(figures.unplaced);
    expect(await statusOf(agent, figures.explanation)).toBe(404);
    expect(await statusOf(agent, figures.unplaced)).toBe(404);
  });
});

describe("a channel's explanation pictures come with the answers (M34)", () => {
  it('gives the explanation picture with the answers, once they are due (REST)', async () => {
    const { figures, agent } = await placedChannel();
    const batch = (await agent.batch()).json();
    expect((await agent.answers(batch.id)).json().error.code).toBe('not_revealed_yet');
    expect(await statusOf(agent, figures.explanation)).toBe(404);
    clock.advance(HOUR);
    const answers = BatchAnswersResponse.parse((await agent.answers(batch.id)).json());
    expect(answers.answers[0]?.pictures).toEqual([url(figures.explanation)]);
    expect(await statusOf(agent, figures.explanation)).toBe(200);
    expect(await statusOf(agent, figures.unplaced)).toBe(404);
  });

  it('gives the explanation picture with the answers, once they are due (MCP)', async () => {
    const { key, figures, agent } = await placedChannel();
    const batch = await mcpCall(key, 'next_batch', { key: 'day-1' });
    expect(batch.questions[0].pictures).toEqual([url(figures.question)]);
    expect(JSON.stringify(batch)).not.toContain(figures.explanation);
    expect(await statusOf(agent, figures.explanation)).toBe(404);
    clock.advance(HOUR);
    const answers = await mcpCall(key, 'batch_answers', { batchId: batch.id });
    expect(answers.answers[0].pictures).toEqual([url(figures.explanation)]);
    expect(await statusOf(agent, figures.explanation)).toBe(200);
  });

  it('never gives the explanation picture when the share reveals only the answers', async () => {
    const { figures, agent } = await placedChannel('answers');
    const batch = (await agent.batch()).json();
    clock.advance(HOUR);
    const answers = (await agent.answers(batch.id)).json();
    expect(answers.answers[0].pictures).toEqual([]);
    expect(answers.answers[0].explanation).toBeNull();
    expect(await statusOf(agent, figures.explanation)).toBe(404);
  });
});

describe("a case's pictures go out with any question of the case (M34, Z8)", () => {
  it('serves a case picture kept on a question the channel never sent', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const [holderId = '', sentId = ''] = await seed(owner, bankId, [
      { stem: 'Holder?' },
      { stem: 'Sent?' },
    ]);
    await seedCase(app.db(), [holderId, sentId], 'A shared case.');
    const caseFigure = await storeFigure(app.db(), holderId, { placement: 'case' });
    await app
      .db()
      .updateTable('question')
      .set({ status: 'excluded' })
      .where('id', '=', holderId)
      .execute();
    const agent = agentOf(app(), (await newChannel(owner, bankId)).key);
    const batch = (await agent.batch()).json();
    expect(batch.questions.map((q: { questionId: string }) => q.questionId)).toEqual([sentId]);
    expect(batch.questions[0].case.pictures).toEqual([url(caseFigure)]);
    expect(await statusOf(agent, caseFigure)).toBe(200);
    const other = await ownerWithBank(app(), 'Other');
    const otherAgent = agentOf(app(), (await newChannel(other.owner, other.bankId)).key);
    expect(await statusOf(otherAgent, caseFigure)).toBe(404);
  });
});

describe("a channel's pictures imported before placements (Q65)", () => {
  it('lists none and serves none, even of a question it sent', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const [sentId = '', keptId = ''] = await seed(owner, bankId, [
      { stem: 'One?' },
      { stem: 'Two?' },
    ]);
    const sentPicture = await storeFigure(app.db(), sentId);
    const keptPicture = await storeFigure(app.db(), keptId);
    const agent = agentOf(app(), (await newChannel(owner, bankId, { chapterIds: [] })).key);
    await app
      .db()
      .updateTable('question')
      .set({ status: 'excluded' })
      .where('id', '=', keptId)
      .execute();
    const batch = (await agent.batch()).json();
    expect(batch.questions[0]).toMatchObject({ pictures: [], optionPictures: {}, case: null });
    clock.advance(HOUR);
    expect((await agent.answers(batch.id)).json().answers[0].pictures).toEqual([]);
    expect(await statusOf(agent, sentPicture)).toBe(404);
    expect(await statusOf(agent, keptPicture)).toBe(404);
    const other = await ownerWithBank(app(), 'Other');
    const otherAgent = agentOf(app(), (await newChannel(other.owner, other.bankId)).key);
    expect(await statusOf(otherAgent, sentPicture)).toBe(404);
  });
});
