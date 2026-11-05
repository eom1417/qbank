import type { SavedStudyNote } from '../../../../contracts/questions.js';
import type { QuestionRepository, QuestionRow } from '../adapters/question-repository.js';
import type { ReviewReason } from '../domain/imported.js';
import { statusNow, triagedValues, type TriageChange } from '../domain/triaged.js';
import type { PairRepository } from '../adapters/pair-repository.js';
import type { ChapterNames } from '../domain/classify.js';
import type { FoundPair } from '../domain/duplicates.js';
import { exactKey, jaccard, SIMILAR_AT, wordsOf } from '../domain/similarity.js';

/** Pairs below this word overlap are not worth asking about. */
const WORTH_ASKING = 0.35;
/** At most this many pairs per run. */
const MOST_PAIRS = 30;

type Owner = { ownerId: string; now: Date };
type Options = { letter: string; text: string }[];

interface AdditionDeps {
  questions: QuestionRepository;
  pairs: PairRepository;
  chaptersOf(ownerId: string, bankId: string): Promise<readonly ChapterNames[]>;
}

const withChange = (row: QuestionRow, change: string) => [...new Set([...row.ai_changes, change])];

type Place = { chapterId: string | null; topicId: string | null; difficulty: number };

/** A suggested place and difficulty, never over the owner's own (DEC-34). */
function placeValues(row: QuestionRow, place: Place) {
  const located = row.classification !== 'manual' && place.chapterId !== null;
  const rated = row.difficulty_kind !== 'manual';
  return {
    ...(located
      ? { chapter_id: place.chapterId, topic_id: place.topicId, classification: 'suggested' }
      : {}),
    ...(rated ? { difficulty: place.difficulty, difficulty_kind: 'inferred' } : {}),
    ai_changes: withChange(row, 'classified'),
  };
}

/** Pairs worth asking about: the given questions with others of the bank, close in words. */
async function similarCandidates(
  pairs: PairRepository,
  bank: { ownerId: string; bankId: string },
  ids: readonly string[],
) {
  const texts = (await pairs.bankTexts(bank.ownerId, bank.bankId)).map((row) => ({
    ...row,
    options: row.options as Options,
  }));
  const asked = new Set(ids);
  const found: FoundPair[] = [];
  for (const b of texts.filter((q) => asked.has(q.id)))
    for (const a of texts.filter((q) => q.id < b.id || !asked.has(q.id))) {
      if (a.id === b.id || exactKey(a) === exactKey(b)) continue;
      const similarity = jaccard(wordsOf(a), wordsOf(b));
      if (similarity >= WORTH_ASKING && similarity < SIMILAR_AT)
        found.push({ a: a.id, b: b.id, kind: 'similar', similarity, differences: [] });
    }
  const byId = new Map(texts.map((q) => [q.id, q]));
  return found
    .sort((x, y) => y.similarity - x.similarity)
    .slice(0, MOST_PAIRS)
    .map((pair) => ({ pair, a: byId.get(pair.a), b: byId.get(pair.b) }));
}

/**
 * Every write the user's AI makes to questions (DEC-33, DEC-34): the triage's decision, a study
 * note, an update note, a suggested place and difficulty, and similar pairs. Each only adds: the owner's own note, place or difficulty is
 * never overwritten, and a pair is only listed, never merged.
 */
export function aiAdditions(deps: AdditionDeps) {
  const save = (owner: Owner, row: QuestionRow, values: Record<string, unknown>) =>
    deps.questions.updateQuestion(owner.ownerId, row.id, values, 'ai_note', owner.now);
  return {
    /** The AI triage's decision, as the question's next version (DEC-33). */
    applyTriage: (
      owner: Owner,
      question: { id: string; reasons: readonly ReviewReason[]; changes: readonly string[] },
      change: TriageChange,
    ) =>
      deps.questions.updateQuestion(
        owner.ownerId,
        question.id,
        triagedValues(question, change),
        'ai_triage',
        owner.now,
      ),
    /** Brings a question the triage left alone to today's eligibility rule (DEC-33). */
    refreshStatus: async (owner: Owner, row: QuestionRow) => {
      const status = statusNow(row);
      if (status === row.status) return;
      await deps.questions.updateQuestion(owner.ownerId, row.id, { status }, 'policy', owner.now);
    },
    /** The AI's study note on a question, apart from the book's explanation (DEC-34). */
    applyStudyNote: (owner: Owner, row: QuestionRow, note: SavedStudyNote) =>
      save(owner, row, {
        study_note: JSON.stringify(note),
        ai_changes: withChange(row, 'study_note'),
      }),
    applyUpdateNote: async (owner: Owner, row: QuestionRow, note: string) => {
      if (row.update_note !== null) return;
      await save(owner, row, { update_note: note, ai_changes: withChange(row, 'update_note') });
    },
    chaptersOfBank: (ownerId: string, bankId: string) => deps.chaptersOf(ownerId, bankId),
    applyPlace: (owner: Owner, row: QuestionRow, place: Place) =>
      save(owner, row, placeValues(row, place)),
    similarCandidates: (ownerId: string, bankId: string, ids: readonly string[]) =>
      similarCandidates(deps.pairs, { ownerId, bankId }, ids),
    saveSimilarPairs: (owner: Owner, bankId: string, pairs: readonly FoundPair[]) =>
      deps.pairs.savePairs(owner.ownerId, bankId, pairs, owner.now),
  };
}
