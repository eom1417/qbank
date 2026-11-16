import type { TruthFile, TruthQuestion } from './truth.js';

// M34 P0 step 4: the code checks every ground-truth file before anyone trusts it.

const MAX_TABLES = 2;
const MAX_IMAGES = 3;

function checkOrder(truth: TruthFile): string[] {
  return truth.questions.flatMap((question, index) =>
    question.ordinal === index + 1 ? [] : [`ordinal ${question.ordinal} at position ${index + 1}`],
  );
}

function checkCounts(truth: TruthFile): string[] {
  const problems: string[] = [];
  if (truth.printedTotal !== null && truth.printedTotal !== truth.questions.length) {
    problems.push(`file prints ${truth.printedTotal} questions, truth has ${truth.questions.length}`);
  }
  for (const heading of truth.headings) {
    const found = truth.questions.filter((q) => q.section === heading.section).length;
    if (found !== heading.count) {
      problems.push(`section "${heading.section}" prints ${heading.count}, truth has ${found}`);
    }
  }
  const known = new Set(truth.headings.map((heading) => heading.section));
  const strays = new Set(truth.questions.map((q) => q.section).filter((s) => !known.has(s)));
  if (truth.headings.length > 0) for (const s of strays) problems.push(`unknown section "${s}"`);
  return problems;
}

function checkStatus(q: TruthQuestion): string[] {
  const problems: string[] = [];
  if (q.status === 'valid') {
    if (q.answer.length === 0) problems.push('valid without an answer');
    if (q.options.length < 2) problems.push('valid with fewer than two options');
    if (q.conflict !== null) problems.push('valid with a conflict');
    if (q.evidence.includes('none')) problems.push('valid with no evidence');
  } else if (!q.statusReason) {
    problems.push(`${q.status} without a reason`);
  }
  return problems;
}

function checkLetters(q: TruthQuestion): string[] {
  const letters = new Set(q.options.map((option) => option.letter));
  const problems: string[] = [];
  if (letters.size !== q.options.length) problems.push('repeated option letter');
  for (const letter of q.answer) {
    if (!letters.has(letter)) problems.push(`answer ${letter} is not an option`);
  }
  for (const image of q.images) {
    const wantsLetter = image.placement === 'option';
    if (wantsLetter !== (image.optionLetter !== null)) problems.push('option image letter mismatch');
    if (image.optionLetter !== null && !letters.has(image.optionLetter)) {
      problems.push(`image for missing option ${image.optionLetter}`);
    }
  }
  return problems;
}

function checkExplanation(q: TruthQuestion): string[] {
  const tables = q.kept.filter((piece) => piece.kind === 'table').length;
  const images = q.kept.filter((p) => p.kind === 'image' || p.kind === 'handwriting_image').length;
  const problems: string[] = [];
  if (tables > MAX_TABLES) problems.push(`${tables} tables kept (max ${MAX_TABLES})`);
  if (images > MAX_IMAGES) problems.push(`${images} images kept (max ${MAX_IMAGES})`);
  return problems;
}

/** Kept pictures and explanation images match page by page, so the app shows what the filter kept. */
function checkKeptImages(q: TruthQuestion): string[] {
  const placed = q.images.filter((image) => image.placement === 'explanation');
  const missing = q.kept
    .filter((piece) => piece.kind === 'image' || piece.kind === 'handwriting_image')
    .filter((piece) => !placed.some((image) => image.page === piece.page))
    .map((piece) => `kept ${piece.kind} on page ${piece.page} has no explanation image`);
  const pictured = q.kept.filter((p) => p.kind !== 'text');
  // A picture of typed words becomes text (Z5), so any kept piece on its page covers it; a
  // table picture with photos is covered by a kept table.
  const covers = (image: (typeof placed)[number]) =>
    (image.isTextPicture ? q.kept : pictured).some((piece) => piece.page === image.page);
  const unkept = placed.filter((image) => !covers(image));
  return [
    ...missing,
    ...unkept.map((image) => `explanation image on page ${image.page} is not kept`),
  ];
}

function checkPages(truth: TruthFile, q: TruthQuestion): string[] {
  const all = [...q.pages, ...q.images.map((i) => i.page), ...q.kept.map((p) => p.page)];
  return all.some((page) => page > truth.pageCount) ? ['page beyond the file'] : [];
}

/** Every problem found, as `Q<ordinal>: …` lines; an empty list means the truth holds together. */
export function checkTruth(truth: TruthFile): string[] {
  const perQuestion = truth.questions.flatMap((q) =>
    [
      ...checkStatus(q),
      ...checkLetters(q),
      ...checkExplanation(q),
      ...checkKeptImages(q),
      ...checkPages(truth, q),
    ].map((problem) => `Q${q.ordinal}: ${problem}`),
  );
  return [...checkOrder(truth), ...checkCounts(truth), ...perQuestion];
}
