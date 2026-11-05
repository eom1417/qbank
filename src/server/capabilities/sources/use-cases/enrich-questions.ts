import type { Enhancements } from '../../../../contracts/sources.js';
import type { AiFailure, AiProvider } from '../../providers/index.js';
import type { QuestionRow } from '../../questions/index.js';
import { batches } from '../domain/triage/batch.js';
import {
  CLASSIFY_PROMPT,
  ClassifyReply,
  SAME_QUESTION_PROMPT,
  SameQuestionReply,
  UPDATE_NOTE_PROMPT,
  UpdateNoteReply,
  classifyText,
  keyedText,
  pairsText,
} from '../domain/triage/extras.js';
import { askBatch } from './ask-batch.js';
import type { SourcesDeps } from './deps.js';
import { asTriage, isOpen, type Option } from './triage-work.js';
import { writeNotes } from './write-notes.js';

type Deps = Pick<SourcesDeps, 'questions' | 'checkLink'>;
type Owner = { ownerId: string; now: Date };

const asked = (row: QuestionRow, index: number) =>
  asTriage(`q${index + 1}`, { stem: row.stem, options: row.options as Option[] });

/** A separate note when a key follows an older guideline (DEC-16: the key itself stays). */
async function updateNotes(deps: Deps, owner: Owner, rows: QuestionRow[], writer: AiProvider) {
  const keyed = rows.filter((row) => row.answer_letter !== null && row.update_note === null);
  for (const group of batches(keyed)) {
    const items = group.map((row, index) => ({
      question: asked(row, index),
      answer: row.answer_letter ?? '',
    }));
    const reply = await askBatch(writer, {
      name: 'update_notes',
      system: UPDATE_NOTE_PROMPT,
      parts: [{ type: 'text', text: keyedText(items) }],
      schema: UpdateNoteReply,
    });
    if (!reply.ok) return reply.failure;
    for (const note of reply.value.notes) {
      const row = group[Number(note.id.slice(1)) - 1];
      if (row && note.outdated && note.note)
        await deps.questions.applyUpdateNote(owner, row, note.note);
    }
  }
  return null;
}

type Chapters = Awaited<ReturnType<Deps['questions']['chaptersOfBank']>>;

/** The chapter and topic a reply names, by the bank's own names (an unknown one is none). */
function placeIn(
  chapters: Chapters,
  place: { chapter: string | null; topic: string | null; difficulty: number },
) {
  const chapter = chapters.find((c) => c.name === place.chapter);
  const topic = chapter?.topics.find((t) => t.name === place.topic);
  return {
    chapterId: chapter?.id ?? null,
    topicId: topic?.id ?? null,
    difficulty: place.difficulty,
  };
}

/** A suggested chapter, topic and difficulty, from the bank's own names. */
async function classify(deps: Deps, owner: Owner, rows: QuestionRow[], writer: AiProvider) {
  const bankId = rows[0]?.bank_id;
  if (!bankId) return null;
  const chapters = await deps.questions.chaptersOfBank(owner.ownerId, bankId);
  const names = chapters
    .map((c) => `${c.name}: ${c.topics.map((t) => t.name).join(', ')}`)
    .join('\n');
  for (const group of batches(rows)) {
    const reply = await askBatch(writer, {
      name: 'classify_questions',
      system: CLASSIFY_PROMPT,
      parts: [{ type: 'text', text: classifyText(group.map(asked), names) }],
      schema: ClassifyReply,
    });
    if (!reply.ok) return reply.failure;
    for (const place of reply.value.places) {
      const row = group[Number(place.id.slice(1)) - 1];
      if (row) await deps.questions.applyPlace(owner, row, placeIn(chapters, place));
    }
  }
  return null;
}

const comparable = (
  id: string,
  question: { stem: string; options: readonly { letter: string; text: string }[] },
) => ({
  id,
  stem: question.stem,
  options: question.options.map(({ letter, text }) => ({ letter, text })),
});

/** Pairs that ask the same thing in other words, listed for the owner (never merged). */
async function similarPairs(deps: Deps, owner: Owner, rows: QuestionRow[], writer: AiProvider) {
  const bankId = rows[0]?.bank_id;
  if (!bankId) return null;
  const ids = rows.map((row) => row.id);
  const candidates = await deps.questions.similarCandidates(owner.ownerId, bankId, ids);
  for (const group of batches(candidates)) {
    const pairs = group.flatMap(({ a, b }, index) =>
      a && b ? [{ id: `q${index + 1}`, a: comparable('a', a), b: comparable('b', b) }] : [],
    );
    const reply = await askBatch(writer, {
      name: 'same_questions',
      system: SAME_QUESTION_PROMPT,
      parts: [{ type: 'text', text: pairsText(pairs) }],
      schema: SameQuestionReply,
    });
    if (!reply.ok) return reply.failure;
    const same = reply.value.pairs
      .filter((p) => p.same)
      .map((p) => group[Number(p.id.slice(1)) - 1]?.pair);
    await deps.questions.saveSimilarPairs(
      owner,
      bankId,
      same.filter((pair) => pair !== undefined),
    );
  }
  return null;
}

/**
 * The chosen additions after the triage (DEC-34), on the saved questions: study notes, update
 * notes, places and similar pairs. Each step runs only when the owner chose it; the first that
 * stops says why, and what is done stays.
 */
export async function enrichQuestions(
  deps: Deps,
  owner: Owner,
  rows: readonly QuestionRow[],
  settings: { writer: AiProvider; enhance: Enhancements },
): Promise<AiFailure | null> {
  const { enhance, writer } = settings;
  const open = rows.filter((row) => isOpen(row) && !row.multi_select);
  const steps = [
    () => writeNotes(deps, owner, open, { writer, ...enhance }),
    () => (enhance.updateNotes ? updateNotes(deps, owner, open, writer) : null),
    () => (enhance.classify ? classify(deps, owner, open, writer) : null),
    () => (enhance.duplicates ? similarPairs(deps, owner, open, writer) : null),
  ];
  let failure: AiFailure | null = null;
  for (const step of steps) failure = (await step()) ?? failure;
  return failure;
}
