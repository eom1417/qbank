import type { NoteView, ReportView } from '../../../../contracts/review.js';
import { notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { Actor } from '../../identity/index.js';
import type { ReportKind } from '../adapters/report-repository.js';
import { owned, type ReviewDeps } from './question-actions.js';

interface NoteRow {
  id: string;
  question_id: string;
  body: string;
  labels: string[];
  created_at: Date;
}

const toNote = (row: NoteRow): NoteView => ({
  id: row.id,
  questionId: row.question_id,
  body: row.body,
  labels: row.labels,
  createdAt: row.created_at.toISOString(),
});

/** A private note on the owner's question (FR-09-009); it never becomes question text. */
export async function addNote(
  deps: ReviewDeps,
  actor: Actor,
  questionId: string,
  note: { body: string; labels: string[] },
) {
  await owned(deps, actor, questionId);
  const id = deps.newId();
  const labels = [...new Set(note.labels)];
  await deps.notes.addNote({
    id,
    ownerId: actor.accountId,
    questionId,
    ...note,
    labels,
    now: deps.clock.now(),
  });
  return { notes: (await deps.notes.notesOf(actor.accountId, questionId)).map(toNote) };
}

export async function notesOf(deps: ReviewDeps, actor: Actor, questionId: string) {
  await owned(deps, actor, questionId);
  return { notes: (await deps.notes.notesOf(actor.accountId, questionId)).map(toNote) };
}

/** Searches the owner's notes by words or label, e.g. «راجع المصدر». */
export async function searchNotes(deps: ReviewDeps, actor: Actor, query: string) {
  const words = query.trim();
  if (words === '') return { notes: [] };
  return { notes: (await deps.notes.searchNotes(actor.accountId, words)).map(toNote) };
}

export async function deleteNote(deps: ReviewDeps, actor: Actor, noteId: string) {
  if (!isId(noteId) || !(await deps.notes.deleteNote(actor.accountId, noteId))) throw notFound();
}

interface ReportRow {
  id: string;
  kind: ReportKind;
  comment: string | null;
  created_at: Date;
  resolved_at: Date | null;
}

const toReport = (row: ReportRow): ReportView => ({
  id: row.id,
  kind: row.kind,
  comment: row.comment,
  createdAt: row.created_at.toISOString(),
  resolved: row.resolved_at !== null,
});

/**
 * A report raised while studying (FR-09-010): it puts the question in front of the owner in
 * review, and changes neither its answer nor any result (FR-24-003, UAT-036).
 */
export async function reportQuestion(
  deps: ReviewDeps,
  actor: Actor,
  questionId: string,
  report: { kind: ReportKind; comment: string | null },
) {
  await owned(deps, actor, questionId);
  await deps.reports.addReport({
    id: deps.newId(),
    ownerId: actor.accountId,
    questionId,
    ...report,
    now: deps.clock.now(),
  });
  return reportsOf(deps, actor, questionId);
}

export async function reportsOf(deps: ReviewDeps, actor: Actor, questionId: string) {
  await owned(deps, actor, questionId);
  return { reports: (await deps.reports.reportsOf(actor.accountId, questionId)).map(toReport) };
}

export async function resolveReport(deps: ReviewDeps, actor: Actor, reportId: string) {
  const done =
    isId(reportId) &&
    (await deps.reports.resolveReport(actor.accountId, reportId, deps.clock.now()));
  if (!done) throw notFound();
}
