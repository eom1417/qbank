/**
 * M34 P4b: the answer-evidence step measured on the truth files (`.data/truth/*.truth.json`).
 *
 *   node --import tsx src/server/tools/extraction-bench/evidence-bench.ts \
 *     --files cardiology,dermatology [--variant light|strong] [--max-calls 600] [--audit 10] \
 *     [--source rules|pipeline] [--units <dir of <slug>.units.json>]
 *
 * `--source rules` (default) reads questions with the rules reader (text layer), each question's
 * area the union of its line spans per page; `--source pipeline` uses P4a's `pipelineQuestions`
 * (files whose questions are pictures, such as Allergy). The lesson runs for real over the
 * logged-in `claude` CLI, with a file-backed step cache and a call ledger under
 * `.data/evidence-bench/` (outside git). `strong` sends every call to the strong model. Only
 * numbers and letters are printed or written: never a word of the files.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AiProvider } from '../../capabilities/providers/index.js';
import type { Box } from '../../capabilities/sources/domain/page.js';
import {
  combineEvidence,
  type VisionVerdict,
} from '../../capabilities/sources/domain/pipeline/evidence.js';
import type {
  PipelineEvidence,
  PipelineQuestion,
  Spot,
} from '../../capabilities/sources/domain/pipeline/question.js';
import type { CachedStep, NewStep } from '../../capabilities/sources/adapters/step-cache.js';
import type { ExtractedQuestion } from '../../capabilities/sources/use-cases/extract-questions.js';
import {
  withEvidence,
  type EvidenceRun,
} from '../../capabilities/sources/use-cases/pipeline-evidence.js';
import type { FileUnits } from '../../capabilities/sources/adapters/pipeline-units.js';
import {
  defaultReaders,
  pipelineQuestions,
  type PipelineReaders,
} from '../../capabilities/sources/use-cases/pipeline-questions.js';
import { withStructure } from '../../capabilities/sources/use-cases/pipeline-structure.js';
import { extractQuestions } from '../../capabilities/sources/use-cases/read-source.js';
import type { LessonDeps } from '../../capabilities/sources/use-cases/run-lesson.js';
import { ClaudeCliProvider } from '../vision-cost/claude-cli-provider.js';
import { argValue } from '../vision-cost/shell.js';
import { TruthFile, type TruthQuestion } from './truth.js';

const DATA = '/workspace/.data';
const OUT = join(DATA, 'evidence-bench');
const STRONG = 'claude-opus-5-5';

const EVIDENCE: Record<string, PipelineEvidence> = {
  answer_key: 'printed_key',
  answer_file: 'printed_key',
  ai_read: 'printed_key',
  pen_mark: 'pen_mark',
  ai_mark: 'pen_mark',
  single_option: 'single_option',
  explanation: 'explanation_text',
};

/** One box per page around the question's lines (stem to last option). */
function areaOf(spans: readonly { page: number; box: Box }[]): Spot[] {
  const pages = [...new Set(spans.map((span) => span.page))];
  return pages.map((page) => {
    const boxes = spans.filter((span) => span.page === page).map((span) => span.box);
    const box = {
      x0: Math.min(...boxes.map((b) => b.x0)),
      y0: Math.min(...boxes.map((b) => b.y0)),
      x1: Math.max(...boxes.map((b) => b.x1)),
      y1: Math.max(...boxes.map((b) => b.y1)),
    };
    return { page, box };
  });
}

/** Stand-in for P4a's pipeline questions: the rules reader's questions in the shared shape. */
export function asPipelineQuestions(extracted: readonly ExtractedQuestion[]): PipelineQuestion[] {
  const seen = new Map<string, number>();
  return extracted.map((q) => {
    const base = `${q.page}-${q.number}`;
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    const evidence = q.evidence === null ? undefined : EVIDENCE[q.evidence];
    return {
      key: `${base}-${occurrence}`,
      number: q.number,
      page: q.page,
      pages: [...new Set(q.spans.map((span) => span.page))],
      stem: q.stem,
      options: q.options.map((option) => ({ ...option, spot: null })),
      area: areaOf(q.spans),
      explanation: q.explanation,
      pictures: [],
      answers: q.answers,
      evidence: evidence ? [evidence] : [],
      conflicts: [...q.conflicts],
      fromPicture: false,
      caseText: null,
      tags: { exam: null, year: null },
      reviewReasons: [],
    };
  });
}

/** Model calls made by every run so far (all variants share the one budget). */
interface Budget {
  calls: number;
  max: number;
}

const readJson = <T>(path: string, fallback: T): T =>
  existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback;

/** A CLI provider that refuses (as a full subscription would) once the call budget is spent. */
function budgeted(budget: Budget, model: string): AiProvider {
  const cli = new ClaudeCliProvider({ model, effort: 'low', timeoutMs: 240_000 });
  return {
    generate(request) {
      if (budget.calls >= budget.max) return Promise.resolve({ ok: false, failure: 'no_quota' });
      budget.calls++;
      return cli.generate(request);
    },
  };
}

interface BenchContext {
  budget: Budget;
  steps: Record<string, NewStep>;
  strong: boolean;
  auditEvery: number;
  source: 'rules' | 'pipeline';
  unitsDir: string | null;
}

type Outcome = 'correct' | 'wrong' | 'undecided';

interface Row {
  file: string;
  ordinal: number;
  truthAnswer: string;
  truthEvidence: string;
  /** Truth decides the answer (valid or single option, with letters). */
  decided: boolean;
  answer: string;
  evidence: string;
  outcome: Outcome | 'invented' | 'none';
  rulesOutcome: Outcome | 'invented' | 'none';
  asked: boolean;
  vision: string | null;
  reasons: string;
}

const decidedTruth = (t: TruthQuestion) =>
  (t.status === 'valid' || t.status === 'single_option') && t.answer.length > 0;

function outcomeOf(t: TruthQuestion, answers: readonly string[]): Row['outcome'] {
  const got = [...answers].sort().join('');
  if (!decidedTruth(t)) return got === '' ? 'none' : 'invented';
  if (got === '') return 'undecided';
  return got === [...t.answer].sort().join('') ? 'correct' : 'wrong';
}

/** The truth question a pipeline question stands for: same printed number, nearest page. */
function matchTruth(truth: readonly TruthQuestion[], q: PipelineQuestion, used: Set<number>) {
  const candidates = truth.filter(
    (t) => !used.has(t.ordinal) && (t.printed ?? t.ordinal) === q.number,
  );
  const distance = (t: TruthQuestion) => Math.abs((t.pages[0] ?? 0) - q.page);
  const best = candidates.sort((a, b) => distance(a) - distance(b))[0];
  if (!best || distance(best) > 1) return null;
  used.add(best.ordinal);
  return best;
}

interface FileRun {
  slug: string;
  questions: number;
  /** Questions read (after D6.1 when it ran), and what D6.1 did with the leftover pictures. */
  read: number;
  structure: { leftovers: number; found: number; review: number } | null;
  seconds: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  asked: number;
  audited: number;
  paused: boolean;
  rows: Row[];
}

function visionText(verdict: VisionVerdict | undefined): string | null {
  if (verdict === undefined || verdict === null) return null;
  return verdict === 'review' ? 'review' : (verdict.mark.letter ?? 'null');
}

function rowsOf(
  slug: string,
  truth: TruthFile,
  rules: readonly PipelineQuestion[],
  run: EvidenceRun,
) {
  const marks = new Map(run.marks.map((mark) => [mark.key, mark.verdict]));
  const used = new Set<number>();
  return rules.flatMap((rule, index): Row[] => {
    const t = matchTruth(truth.questions, rule, used);
    const done = run.questions[index];
    if (!t || !done) return [];
    return [
      {
        file: slug,
        ordinal: t.ordinal,
        truthAnswer: t.answer.join(''),
        truthEvidence: t.evidence.join('+'),
        decided: decidedTruth(t),
        answer: done.answers.join(''),
        evidence: done.evidence.join('+'),
        outcome: outcomeOf(t, done.answers),
        rulesOutcome: outcomeOf(t, combineEvidence(rule, null).answers),
        asked: run.asked.includes(rule.key),
        vision: visionText(marks.get(rule.key)),
        reasons: [...done.reviewReasons, ...done.conflicts].join('; '),
      },
    ];
  });
}

function lessonDeps(context: BenchContext): LessonDeps {
  const { steps } = context;
  return {
    ownerId: 'evidence-bench',
    providerKind: 'claude',
    providerFor: (model) => budgeted(context.budget, context.strong ? STRONG : model),
    cache: {
      get: (_owner, key) => Promise.resolve<CachedStep | null>(steps[key] ?? null),
      put: (step) => Promise.resolve(void (steps[step.key] = step)),
    },
    now: () => new Date(),
  };
}

/** Units saved by an earlier run (`<dir>/<slug>.units.json`), read only; else read afresh. */
function unitsFrom(dir: string | null, slug: string): PipelineReaders {
  const path = dir === null ? null : join(dir, `${slug}.units.json`);
  if (path === null || !existsSync(path)) return defaultReaders;
  const units = JSON.parse(readFileSync(path, 'utf8')) as FileUnits;
  return { ...defaultReaders, units: () => Promise.resolve(units) };
}

/** Image units that are printed (not handwriting): blanked in the vision crops. */
const printedPictures = (units: FileUnits): Spot[] =>
  units.pages.flatMap((page) =>
    page.units
      .filter((unit) => unit.kind === 'image' && unit.imageClass !== 'handwriting')
      .map((unit) => ({ page: unit.page, box: unit.box })),
  );

/** The questions to score: the rules reader's, or P4a's plus D6.1 over its leftover pictures. */
async function readQuestions(file: string, slug: string, context: BenchContext) {
  if (context.source === 'rules')
    return {
      questions: asPipelineQuestions(await extractQuestions(file, 'text')),
      structure: null,
      pictures: [],
    };
  const read = await pipelineQuestions(file, unitsFrom(context.unitsDir, slug));
  const { leftovers } = read;
  const structure = await withStructure(lessonDeps(context), read.questions, leftovers, {
    concurrency: 3,
  });
  const summary = {
    leftovers: leftovers.length,
    found: structure.found.length,
    review: structure.review.length,
  };
  return {
    questions: structure.questions,
    structure: { ...summary, usage: structure.usage },
    pictures: printedPictures(read.units),
  };
}

async function benchFile(slug: string, context: BenchContext): Promise<FileRun> {
  const truth = TruthFile.parse(
    JSON.parse(readFileSync(join(DATA, 'truth', `${slug}.truth.json`), 'utf8')),
  );
  const file = join(DATA, 'corpus', truth.file);
  const started = Date.now();
  const callsBefore = context.budget.calls;
  const { questions: rules, structure, pictures } = await readQuestions(file, slug, context);
  const run = await withEvidence(lessonDeps(context), file, rules, {
    concurrency: 3,
    auditEvery: context.auditEvery,
    printedPictures: pictures,
  });
  const usage = [...run.usage, ...(structure?.usage ?? [])];
  return {
    slug,
    questions: truth.questions.length,
    read: rules.length,
    structure: structure && {
      leftovers: structure.leftovers,
      found: structure.found,
      review: structure.review,
    },
    seconds: (Date.now() - started) / 1000,
    calls: context.budget.calls - callsBefore,
    inputTokens: usage.reduce((sum, u) => sum + u.inputTokens, 0),
    outputTokens: usage.reduce((sum, u) => sum + u.outputTokens, 0),
    asked: run.asked.length,
    audited: run.audited.length,
    paused: run.paused,
    rows: rowsOf(slug, truth, rules, run),
  };
}

function tally(rows: readonly Row[], pick: (row: Row) => string) {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[pick(row)] = (counts[pick(row)] ?? 0) + 1;
  return counts;
}

/** Vision letters against truth, on questions the truth decides. */
function visionScore(rows: readonly Row[]) {
  const shown = rows.filter((row) => row.asked && row.decided);
  const lettered = shown.filter((row) => row.vision !== null && /^[A-Z]+$/.test(row.vision));
  const right = lettered.filter((row) => row.vision === row.truthAnswer).length;
  const accuracy = lettered.length ? right / lettered.length : null;
  return { shown: shown.length, decided: lettered.length, right, accuracy };
}

const structureCell = ({ structure: s }: FileRun) =>
  s ? `${s.leftovers}/${s.found}/${s.review}` : '-';

function report(runs: readonly FileRun[], variant: string, budget: Budget): string {
  const lines = [
    `# Evidence bench (${variant})`,
    '',
    '| file | Q | read | D6.1 left/found/review | matched | correct | wrong | undecided | invented | rules: c/w/u | asked (audit) | calls | tokens in/out | s |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const run of runs) {
    const o = tally(run.rows, (row) => row.outcome);
    const r = tally(run.rows, (row) => row.rulesOutcome);
    lines.push(
      `| ${run.slug} | ${run.questions} | ${run.read} | ${structureCell(run)} | ${run.rows.length} | ${o['correct'] ?? 0} | ${o['wrong'] ?? 0} | ${o['undecided'] ?? 0} | ${o['invented'] ?? 0} | ${r['correct'] ?? 0}/${r['wrong'] ?? 0}/${r['undecided'] ?? 0} | ${run.asked} (${run.audited}) | ${run.calls} | ${run.inputTokens}/${run.outputTokens} | ${run.seconds.toFixed(0)} |`,
    );
  }
  const all = runs.flatMap((run) => run.rows);
  const byEvidence = tally(
    all.filter((row) => row.decided),
    (row) => `${row.evidence || 'none'}:${row.outcome}`,
  );
  lines.push(
    '',
    '## By final evidence (truth-decided questions)',
    '',
    ...Object.entries(byEvidence)
      .sort()
      .map(([k, v]) => `- ${k}: ${v}`),
  );
  lines.push(
    '',
    `## Vision mark: ${JSON.stringify(visionScore(all))}`,
    '',
    `Model calls so far (all runs): ${budget.calls} of ${budget.max}`,
  );
  return lines.join('\n');
}

async function main(argv: readonly string[]): Promise<void> {
  const files = argValue(argv, 'files', '').split(',').filter(Boolean);
  const variant = argValue(argv, 'variant', 'light') === 'strong' ? 'strong' : 'light';
  mkdirSync(OUT, { recursive: true });
  const stepsPath = join(OUT, `steps-${variant}.json`);
  const budgetPath = join(OUT, 'calls.json');
  const context: BenchContext = {
    budget: {
      calls: readJson(budgetPath, { calls: 0 }).calls,
      max: Number(argValue(argv, 'max-calls', '600')),
    },
    steps: readJson<Record<string, NewStep>>(stepsPath, {}),
    strong: variant === 'strong',
    source: argValue(argv, 'source', 'rules') === 'pipeline' ? 'pipeline' : 'rules',
    unitsDir: argValue(argv, 'units', '') || null,
    auditEvery: Number(argValue(argv, 'audit', '10')),
  };
  const runs: FileRun[] = [];
  try {
    for (const slug of files) runs.push(await benchFile(slug, context));
  } finally {
    writeFileSync(budgetPath, JSON.stringify({ calls: context.budget.calls }));
    writeFileSync(stepsPath, JSON.stringify(context.steps));
  }
  writeFileSync(join(OUT, `results-${variant}.json`), JSON.stringify(runs, null, 1));
  console.log(report(runs, variant, context.budget));
}

if (process.argv[1]?.endsWith('evidence-bench.ts')) await main(process.argv.slice(2));
