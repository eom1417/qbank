import { sql } from 'kysely';
import type { Db } from '../../../platform/db/index.js';

const count = (value: unknown) => Number(value ?? 0);

/** A channel's totals from its own tables only (DEC-36). */
async function totals(db: Db, channelId: string, cycle: number) {
  const row = await db
    .selectFrom('channel as c')
    .select([
      sql<string>`(select count(*) from channel_delivery d where d.channel_id = c.id)`.as('sent'),
      sql<string>`(select count(*) from channel_delivery d where d.channel_id = c.id and d.cycle = ${cycle})`.as(
        'sentThisCycle',
      ),
      sql<string>`(select count(*) from channel_batch b where b.channel_id = c.id)`.as('batches'),
      sql<string>`(select count(*) from channel_answer a where a.channel_id = c.id)`.as('answers'),
      sql<string>`(select count(*) from channel_answer a where a.channel_id = c.id and a.correct)`.as(
        'correct',
      ),
    ])
    .where('c.id', '=', channelId)
    .executeTakeFirstOrThrow();
  return {
    sentTotal: count(row.sent),
    sentThisCycle: count(row.sentThisCycle),
    batches: count(row.batches),
    answers: count(row.answers),
    correct: count(row.correct),
  };
}

/** Each question the channel sent: how often, and how its recipients answered. */
function perQuestion(db: Db, channelId: string) {
  return db
    .selectFrom('channel_delivery as d')
    .leftJoin('channel_answer as a', 'a.delivery_id', 'd.id')
    .select([
      'd.question_id as questionId',
      sql<string>`count(distinct d.id)`.as('sent'),
      sql<string>`count(a.delivery_id)`.as('answers'),
      sql<string>`count(a.delivery_id) filter (where a.correct)`.as('correct'),
    ])
    .where('d.channel_id', '=', channelId)
    .groupBy('d.question_id')
    .orderBy(sql`count(distinct d.id)`, 'desc')
    .limit(50)
    .execute();
}

/** The latest batches, newest first. */
function recentBatches(db: Db, channelId: string) {
  return db
    .selectFrom('channel_batch as b')
    .select([
      'b.id as batchId',
      'b.created_at as at',
      sql<string>`(select count(*) from channel_delivery d where d.batch_id = b.id)`.as(
        'questions',
      ),
    ])
    .where('b.channel_id', '=', channelId)
    .orderBy('b.created_at', 'desc')
    .limit(10)
    .execute();
}

export async function channelNumbers(db: Db, channelId: string, cycle: number) {
  const [sums, questions, recent] = await Promise.all([
    totals(db, channelId, cycle),
    perQuestion(db, channelId),
    recentBatches(db, channelId),
  ]);
  return {
    ...sums,
    questions: questions.map((q) => ({
      questionId: q.questionId,
      sent: count(q.sent),
      answers: count(q.answers),
      correct: count(q.correct),
    })),
    recent: recent.map((b) => ({
      batchId: b.batchId,
      at: b.at.toISOString(),
      questions: count(b.questions),
    })),
  };
}
