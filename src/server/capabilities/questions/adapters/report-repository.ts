import type { Db } from '../../../platform/db/index.js';

export type ReportKind = 'ambiguous' | 'image_missing' | 'wrong_key' | 'other';

interface NewReport {
  id: string;
  ownerId: string;
  questionId: string;
  kind: ReportKind;
  comment: string | null;
  now: Date;
}

const addReport = (db: Db, report: NewReport) =>
  db
    .insertInto('question_report')
    .values({
      id: report.id,
      owner_id: report.ownerId,
      question_id: report.questionId,
      kind: report.kind,
      comment: report.comment,
      created_at: report.now,
      resolved_at: null,
    })
    .execute();

const reportsOf = (db: Db, ownerId: string, questionId: string) =>
  db
    .selectFrom('question_report')
    .selectAll()
    .where('owner_id', '=', ownerId)
    .where('question_id', '=', questionId)
    .orderBy('created_at', 'desc')
    .execute();

const resolveReport = async (db: Db, ownerId: string, reportId: string, now: Date) => {
  const result = await db
    .updateTable('question_report')
    .set({ resolved_at: now })
    .where('owner_id', '=', ownerId)
    .where('id', '=', reportId)
    .where('resolved_at', 'is', null)
    .executeTakeFirst();
  return result.numUpdatedRows > 0n;
};

/**
 * Reports raised while studying (FR-09-010): they reach review and change nothing on their own
 * (FR-24-003); only the owner's decision does.
 */
export function createReportRepository(db: Db) {
  return {
    addReport: (report: NewReport) => addReport(db, report),
    reportsOf: (ownerId: string, questionId: string) => reportsOf(db, ownerId, questionId),
    resolveReport: (ownerId: string, reportId: string, now: Date) =>
      resolveReport(db, ownerId, reportId, now),
  };
}

export type ReportRepository = ReturnType<typeof createReportRepository>;
