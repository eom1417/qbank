import type { PipelineQuestion } from '../../capabilities/sources/domain/pipeline/question.js';
import type { Unit } from '../../capabilities/sources/domain/pipeline/units.js';
import { similarity } from './score.js';
import type { TruthFile, TruthQuestion } from './truth.js';

// M34 P4a bench: the pipeline's questions scored against a truth file. Numbers only: no text
// or picture of the owner's files leaves the scorer.

/** Below this stem similarity a question found without its number is not the truth's. */
const MIN_STEM_MATCH = 0.6;

export interface PipelineScore {
  expected: number;
  found: number;
  /** Questions read that match no truth question. */
  extra: number;
  /** Mean stem similarity of the matched questions (0–1). */
  stemSimilarity: number;
  optionsExact: number;
  explanationImages: number;
  explanationPlaced: number;
  textPictures: number;
  textPicturesAsText: number;
  /** Pictures shown with the question or an option beyond what the truth shows there. */
  leaks: number;
  answersDecidable: number;
  answersCorrect: number;
  answersWrong: number;
  answersUndecided: number;
  /** Answers the rules gave where the truth decides none. */
  answersUnfounded: number;
  /** Kept text pieces of the truth (matched questions), and those our explanation holds. */
  explanationPieces: number;
  explanationFound: number;
  /** Pictures that look like questions but gave none, left for the vision lesson. */
  leftovers: number;
}

type Pair = [TruthQuestion, PipelineQuestion];

const fullStem = (question: PipelineQuestion) =>
  question.caseText ? `${question.caseText} ${question.stem}` : question.stem;

const stemMatch = (truth: TruthQuestion, question: PipelineQuestion) =>
  Math.max(similarity(truth.stem, question.stem), similarity(truth.stem, fullStem(question)));

/** Share of the truth stem's first words that our stem (with its case) holds, in any order. */
function wordRecall(truth: TruthQuestion, question: PipelineQuestion): number {
  const ours = new Set(stemWords(fullStem(question)));
  const theirs = stemWords(truth.stem).slice(0, RECALL_WORDS);
  return theirs.length === 0 ? 0 : theirs.filter((word) => ours.has(word)).length / theirs.length;
}

const stemWords = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 1);
const RECALL_WORDS = 12;
/** A number match whose stems share less than this is a different question with that number. */
const MIN_NUMBERED_MATCH = 0.3;

const stemScore = (truth: TruthQuestion, question: PipelineQuestion) =>
  Math.max(stemMatch(truth, question), wordRecall(truth, question));

const nearPages = (truth: TruthQuestion, question: PipelineQuestion) =>
  truth.pages.some((page) => question.pages.some((own) => Math.abs(own - page) <= 1));

/**
 * Pairs truth and read questions: by printed number on the same page when the stems agree
 * (the best stem among several), then by stem on the same or a neighbouring page, best
 * pairs first. A screenshot may print another bank's number, so a number alone never decides.
 */
export function matchQuestions(
  truth: readonly TruthQuestion[],
  read: readonly PipelineQuestion[],
): Pair[] {
  const free = new Set(read);
  const pairs: Pair[] = [];
  const rest: TruthQuestion[] = [];
  for (const t of truth) {
    const scored = [...free]
      .filter((q) => q.number === t.printed && t.pages.includes(q.page))
      .map((q) => ({ q, score: stemScore(t, q) }))
      .filter(({ score }) => score >= MIN_NUMBERED_MATCH)
      .sort((a, b) => b.score - a.score);
    const best = scored[0]?.q;
    if (best) {
      free.delete(best);
      pairs.push([t, best]);
    } else rest.push(t);
  }
  const candidates = rest
    .flatMap((t) =>
      [...free].filter((q) => nearPages(t, q)).map((q) => ({ t, q, s: stemScore(t, q) })),
    )
    .filter(({ s }) => s >= MIN_STEM_MATCH)
    .sort((a, b) => b.s - a.s);
  const taken = new Set<TruthQuestion>();
  for (const { t, q } of candidates) {
    if (taken.has(t) || !free.has(q)) continue;
    taken.add(t);
    free.delete(q);
    pairs.push([t, q]);
  }
  return pairs;
}

const count = <T>(items: readonly T[], test: (item: T) => boolean) => items.filter(test).length;
const shown = new Set(['question', 'option', 'case']);
const TEXT_CLASSES = new Set(['text_picture', 'table']);

/** One question's pictures on one page, against the truth's images there. */
function onPage(truth: TruthQuestion, read: PipelineQuestion, page: number) {
  const images = truth.images.filter((image) => image.page === page);
  const pictures = read.pictures.filter((picture) => picture.spot.page === page);
  const ours = count(pictures, (p) => p.placement === 'explanation');
  const wanted = count(images, (i) => i.placement === 'explanation' && !i.isTextPicture);
  const wantedText = count(images, (i) => i.placement === 'explanation' && i.isTextPicture);
  const placed = Math.min(wanted, ours);
  // A picture of words left a picture is still in the right place (shown after the reveal).
  const keptText = Math.min(wantedText, ours - placed);
  const before = count(images, (image) => image.placement !== 'explanation');
  return {
    placed: placed + keptText,
    textLeft: wantedText - keptText,
    leaks: Math.max(0, count(pictures, (p) => shown.has(p.placement)) - before),
  };
}

/** Pictures of printed words turned to text: per page, those not left as pictures. */
function turnedOn(page: number, read: readonly PipelineQuestion[], units: readonly Unit[]) {
  const pictured = new Set(read.flatMap((q) => q.pictures.map((picture) => picture.unitId)));
  return count(
    units,
    (u) => u.page === page && TEXT_CLASSES.has(u.imageClass ?? '') && !pictured.has(u.id),
  );
}

/**
 * Explanation pictures in the right place (as a picture after the reveal, or turned to the
 * explanation's text), and pictures shown before the reveal beyond what the truth shows.
 */
function placementOf(pairs: readonly Pair[], read: readonly PipelineQuestion[], units: Unit[]) {
  let placed = 0;
  let leaks = 0;
  const textLeft = new Map<number, number>();
  for (const [truth, question] of pairs) {
    const imagePages = truth.images.map((image) => image.page);
    for (const page of new Set([...truth.pages, ...question.pages, ...imagePages])) {
      const here = onPage(truth, question, page);
      placed += here.placed;
      leaks += here.leaks;
      textLeft.set(page, (textLeft.get(page) ?? 0) + here.textLeft);
    }
  }
  for (const [page, left] of textLeft) placed += Math.min(left, turnedOn(page, read, units));
  return { placed, leaks };
}

/** Pictures of printed words turned to text: per page, those not left as pictures. */
function textPicturesOf(truth: TruthFile, read: readonly PipelineQuestion[], units: Unit[]) {
  const truthImages = truth.questions.flatMap((q) => q.images);
  let asText = 0;
  for (const page of new Set(truthImages.map((image) => image.page))) {
    const wanted = count(truthImages, (image) => image.page === page && image.isTextPicture);
    asText += Math.min(wanted, turnedOn(page, read, units));
  }
  return { total: count(truthImages, (image) => image.isTextPicture), asText };
}

const decides = (truth: TruthQuestion) =>
  (truth.status === 'valid' || truth.status === 'single_option') && truth.answer.length > 0;

function answersOf(pairs: readonly Pair[]) {
  const outcome = ([truth, read]: Pair) => {
    if (!decides(truth)) return read.answers.length > 0 ? 'unfounded' : 'skip';
    if (read.answers.length === 0) return 'undecided';
    const same = [...read.answers].sort().join() === [...truth.answer].sort().join();
    return same ? 'correct' : 'wrong';
  };
  const outcomes = pairs.map(outcome);
  return {
    answersDecidable: count(pairs, ([truth]) => decides(truth)),
    answersCorrect: count(outcomes, (o) => o === 'correct'),
    answersWrong: count(outcomes, (o) => o === 'wrong'),
    answersUndecided: count(outcomes, (o) => o === 'undecided'),
    answersUnfounded: count(outcomes, (o) => o === 'unfounded'),
  };
}

const ANCHOR_WORDS = 5;
const LOOSE_WORDS = 8;
const LOOSE_SHARE = 0.8;
const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/** Our explanation holds the piece: its first words in a row, or most of its first words. */
function holds(explanation: string, anchor: string): boolean {
  const ours = words(explanation);
  const first = words(anchor);
  if (first.length === 0) return true;
  if (` ${ours.join(' ')} `.includes(` ${first.slice(0, ANCHOR_WORDS).join(' ')} `)) return true;
  const set = new Set(ours);
  const loose = first.slice(0, LOOSE_WORDS);
  return loose.filter((word) => set.has(word)).length >= loose.length * LOOSE_SHARE;
}

/** Every kept text piece of the truth; those of questions we did not find count as missed. */
function explanationsOf(truth: TruthFile, pairs: readonly Pair[]) {
  const pieces = pairs.flatMap(([question, read]) =>
    question.kept.filter((piece) => piece.kind === 'text').map((piece) => ({ piece, read })),
  );
  const all = truth.questions.flatMap((q) => q.kept).filter((piece) => piece.kind === 'text');
  return {
    explanationPieces: all.length,
    explanationFound: count(pieces, ({ piece, read }) =>
      holds(read.explanation ?? '', piece.anchor),
    ),
  };
}

/** Match option content as well as letters; whitespace and Unicode presentation are formatting. */
export function optionsMatch(
  expected: readonly { letter: string; text: string }[],
  actual: readonly { letter: string; text: string }[],
): boolean {
  const normalized = (text: string) => text.normalize('NFKC').replace(/\s+/g, ' ').trim();
  return (
    expected.length === actual.length &&
    expected.every((option, index) => {
      const read = actual[index];
      return read?.letter === option.letter && normalized(read.text) === normalized(option.text);
    })
  );
}

export function scorePipeline(
  truth: TruthFile,
  read: readonly PipelineQuestion[],
  units: Unit[],
  leftovers = 0,
): PipelineScore {
  const pairs = matchQuestions(truth.questions, read);
  const placement = placementOf(pairs, read, units);
  const text = textPicturesOf(truth, read, units);
  const images = truth.questions.flatMap((question) => question.images);
  const stems = pairs.map(([t, q]) => stemMatch(t, q));
  return {
    expected: truth.questions.length,
    found: pairs.length,
    extra: read.length - pairs.length,
    stemSimilarity: stems.length > 0 ? stems.reduce((a, b) => a + b, 0) / stems.length : 0,
    optionsExact: count(pairs, ([t, q]) => optionsMatch(t.options, q.options)),
    explanationImages: count(images, (image) => image.placement === 'explanation'),
    explanationPlaced: placement.placed,
    textPictures: text.total,
    textPicturesAsText: text.asText,
    leaks: placement.leaks,
    ...answersOf(pairs),
    ...explanationsOf(truth, pairs),
    leftovers,
  };
}
