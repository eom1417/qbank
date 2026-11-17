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
}

type Pair = [TruthQuestion, PipelineQuestion];

const fullStem = (question: PipelineQuestion) =>
  question.caseText ? `${question.caseText} ${question.stem}` : question.stem;

const stemMatch = (truth: TruthQuestion, question: PipelineQuestion) =>
  Math.max(similarity(truth.stem, question.stem), similarity(truth.stem, fullStem(question)));

/** Pairs truth and read questions: by printed number on the same page, else by stem. */
export function matchQuestions(
  truth: readonly TruthQuestion[],
  read: readonly PipelineQuestion[],
): Pair[] {
  const free = new Set(read);
  const pairs: Pair[] = [];
  const take = (t: TruthQuestion, q: PipelineQuestion | undefined) => {
    if (!q) return;
    free.delete(q);
    pairs.push([t, q]);
  };
  const unnumbered: TruthQuestion[] = [];
  for (const t of truth) {
    const byNumber = [...free].find((q) => q.number === t.printed && t.pages.includes(q.page));
    if (byNumber) take(t, byNumber);
    else unnumbered.push(t);
  }
  for (const t of unnumbered) {
    const near = [...free].filter((q) => t.pages.some((page) => q.pages.includes(page)));
    const scored = near.map((q) => ({ q, score: stemMatch(t, q) }));
    const best = scored.sort((a, b) => b.score - a.score)[0];
    if (best && best.score >= MIN_STEM_MATCH) take(t, best.q);
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

const letters = (options: readonly { letter: string }[]) => options.map((o) => o.letter).join('');

export function scorePipeline(
  truth: TruthFile,
  read: readonly PipelineQuestion[],
  units: Unit[],
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
    optionsExact: count(pairs, ([t, q]) => letters(t.options) === letters(q.options)),
    explanationImages: count(images, (image) => image.placement === 'explanation'),
    explanationPlaced: placement.placed,
    textPictures: text.total,
    textPicturesAsText: text.asText,
    leaks: placement.leaks,
    ...answersOf(pairs),
  };
}
