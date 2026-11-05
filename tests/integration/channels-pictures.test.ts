import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { agentOf, newChannel } from '../support/channels.js';
import { ownerWithBank } from '../support/client.js';
import { useReviewSuite } from '../support/questions.js';

const { app, seed } = useReviewSuite();
const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

/** A stored picture of the question, as an import would have left it. */
async function pictureOf(questionId: string) {
  const question = await app
    .db()
    .selectFrom('question')
    .select(['owner_id', 'source_id'])
    .where('id', '=', questionId)
    .executeTakeFirstOrThrow();
  const key = randomUUID();
  const folder = resolve(`.data/test-app/${process.pid}`, 'blobs', key.slice(0, 2));
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, key), PNG);
  const id = randomUUID();
  await app
    .db()
    .insertInto('media')
    .values({
      id,
      owner_id: question.owner_id,
      source_id: question.source_id,
      question_id: questionId,
      position: 0,
      page: 1,
      box: JSON.stringify({ x0: 0, y0: 0, x1: 1, y1: 1 }),
      kind: 'figure',
      modality: null,
      link: 'certain',
      blob_key: key,
      width: 10,
      height: 10,
      quality: JSON.stringify({}),
      low_quality: false,
      created_at: new Date(),
    })
    .execute();
  return id;
}

describe("a channel's pictures (DEC-36)", () => {
  it('serves the pictures of questions it sent, and no other picture', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const [sentId = '', keptId = ''] = await seed(owner, bankId, [
      { stem: 'One?' },
      { stem: 'Two?' },
    ]);
    const sentPicture = await pictureOf(sentId);
    const keptPicture = await pictureOf(keptId);
    const agent = agentOf(app(), (await newChannel(owner, bankId, { chapterIds: [] })).key);
    await app
      .db()
      .updateTable('question')
      .set({ status: 'excluded' })
      .where('id', '=', keptId)
      .execute();
    const batch = (await agent.batch()).json();
    expect(batch.questions[0].pictures).toEqual([`/api/channel/v1/pictures/${sentPicture}`]);
    const picture = await agent.picture(sentPicture);
    expect([picture.statusCode, picture.headers['content-type']]).toEqual([200, 'image/png']);
    expect((await agent.picture(keptPicture)).statusCode).toBe(404);
    const other = await ownerWithBank(app(), 'Other');
    const otherAgent = agentOf(app(), (await newChannel(other.owner, other.bankId)).key);
    expect((await otherAgent.picture(sentPicture)).statusCode).toBe(404);
  });
});
