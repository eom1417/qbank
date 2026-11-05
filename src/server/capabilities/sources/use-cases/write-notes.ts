import type { SavedStudyNote, StudyNote } from '../../../../contracts/questions.js';
import type { AiFailure, AiProvider } from '../../providers/index.js';
import type { QuestionRow } from '../../questions/index.js';
import { mapWithLimit } from '../../../platform/concurrency.js';
import { batches } from '../domain/triage/batch.js';
import {
  OPTIONS_NOTE_PROMPT,
  StudyNotesReply,
  TOPIC_REVIEW_PROMPT,
  studyNoteText,
  type ToNote,
} from '../domain/triage/study-note.js';
import { askBatch } from './ask-batch.js';
import type { SourcesDeps } from './deps.js';
import { asTriage, isOpen, type Option } from './triage-work.js';

/** Research turns at once (each searches and reads pages), and short notes per request. */
const RESEARCHING = 3;
const PER_REQUEST = 4;
/** A stem shorter than this many words reads as notes, not a question. */
const NOTES_ONLY = 6;
const DOUBTS = new Set(['no_answer', 'ai_disagrees', 'empty_stem', 'garbled_text']);

/** A question a student cannot learn from as printed: a topic review helps most here. */
const incomplete = (row: QuestionRow) =>
  row.kind === 'essay' ||
  row.answer_letters.length === 0 ||
  row.answer_provenance === 'conflict' ||
  row.stem.trim().split(/\s+/).length < NOTES_ONLY ||
  row.review_reasons.some((reason) => DOUBTS.has(reason));

const toNote = (row: QuestionRow, index: number): ToNote => ({
  question: asTriage(`q${index + 1}`, { stem: row.stem, options: row.options as Option[] }),
  answer: row.answer_letter,
  fileAnswer: row.file_answer,
});

type Saver = (row: QuestionRow, note: SavedStudyNote) => Promise<void>;

/** Asks for one group's notes and saves each, its links checked (DEC-34). */
async function noteGroup(
  writer: AiProvider,
  group: { rows: QuestionRow[]; kind: SavedStudyNote['kind'] },
  deps: { checkLink(url: string): Promise<boolean>; save: Saver },
): Promise<AiFailure | null> {
  const items = group.rows.map(toNote);
  const researched = group.kind === 'topic_review';
  const reply = await askBatch(writer, {
    name: researched ? 'topic_review' : 'options_note',
    system: researched ? TOPIC_REVIEW_PROMPT : OPTIONS_NOTE_PROMPT,
    parts: [{ type: 'text', text: studyNoteText(items) }],
    schema: StudyNotesReply,
    research: researched,
  });
  if (!reply.ok) return reply.failure;
  for (const { id, ...note } of reply.value.notes) {
    const row = group.rows[items.findIndex((item) => item.question.id === id)];
    if (!row) continue;
    const sources = await checkedSources(note, deps.checkLink);
    await deps.save(row, { ...note, sources, kind: group.kind, researched });
  }
  return null;
}

/** A cited link stays only when the page opens; the source's title stays either way. */
async function checkedSources(note: StudyNote, checkLink: (url: string) => Promise<boolean>) {
  return Promise.all(
    note.sources.map(async (source) => ({
      title: source.title,
      url: source.url && (await checkLink(source.url)) ? source.url : null,
    })),
  );
}

export interface NoteSettings {
  writer: AiProvider;
  topicReview: boolean;
  explainOptions: boolean;
}

/**
 * Study notes (DEC-34) for questions that have none: a researched topic review for incomplete or
 * unclear ones, and a short note on the options for the rest when asked. Kept apart from the
 * book's explanation. Returns why the AI stopped, if it did.
 */
export async function writeNotes(
  deps: Pick<SourcesDeps, 'questions' | 'checkLink'>,
  owner: { ownerId: string; now: Date },
  rows: readonly QuestionRow[],
  settings: NoteSettings,
): Promise<AiFailure | null> {
  const open = rows.filter((row) => isOpen(row) && !row.multi_select && row.study_note === null);
  const topics = settings.topicReview ? open.filter(incomplete) : [];
  const options = settings.explainOptions
    ? open.filter(
        (row) => !topics.includes(row) && row.kind === 'mcq' && row.answer_letters.length > 0,
      )
    : [];
  const save: Saver = (row, note) => deps.questions.applyStudyNote(owner, row, note);
  const io = { checkLink: deps.checkLink, save };
  const groups = [
    ...topics.map((row) => ({ rows: [row], kind: 'topic_review' as const })),
    ...batches(options, PER_REQUEST).map((group) => ({ rows: group, kind: 'options' as const })),
  ];
  const failures = await mapWithLimit(groups, RESEARCHING, (group) =>
    noteGroup(settings.writer, group, io),
  );
  return failures.find((failure) => failure !== null) ?? null;
}
