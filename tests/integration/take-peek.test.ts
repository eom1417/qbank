import { describe, expect, it } from 'vitest';
import { TakeItemResponse, TakeStateResponse } from '../../src/contracts/take.js';
import { ownerWithBank } from '../support/client.js';
import { useReviewSuite } from '../support/questions.js';
import { movableClock, newShare, takerOf, type PolicyChanges } from '../support/take.js';

// M34 U3: the take page reads the next question ahead without opening it.

const clock = movableClock();
const { app, seed } = useReviewSuite({ clock });

async function startedExam(changes: PolicyChanges = {}) {
  const { owner, bankId } = await ownerWithBank(app());
  await seed(
    owner,
    bankId,
    Array.from({ length: 3 }, (_, i) => ({ stem: `Peek question ${i + 1}?`, answers: ['B'] })),
  );
  const share = await newShare(owner, bankId, 'exam', { content: { size: 3 }, ...changes });
  const taker = takerOf(app(), share.token);
  await taker.start({ name: 'Sara Ali' });
  await taker.item(0);
  return taker;
}

describe('peeking at the next question (M34 U3)', () => {
  it('shows the next question without moving the attempt or revealing anything', async () => {
    const taker = await startedExam({ limits: { navigation: 'forward' } });
    const peeked = await taker.peek(1);
    expect(peeked.statusCode).toBe(200);
    const next = TakeItemResponse.parse(peeked.json());
    expect([next.position, next.feedback]).toEqual([1, null]);
    const state = TakeStateResponse.parse((await taker.state()).json());
    expect(state.position).toBe(0);
    expect((await taker.choose(0, ['B'])).statusCode).toBe(200);
  });

  it('refuses any question other than the next one', async () => {
    const taker = await startedExam();
    expect((await taker.peek(0)).statusCode).toBe(404);
    expect((await taker.peek(2)).statusCode).toBe(404);
  });

  it('refuses once the attempt is submitted', async () => {
    const taker = await startedExam();
    await taker.submit();
    expect((await taker.peek(1)).statusCode).toBe(404);
  });
});
