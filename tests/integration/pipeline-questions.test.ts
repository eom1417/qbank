import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, type Page } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PipelineQuestion } from '../../src/server/capabilities/sources/domain/pipeline/question.js';
import {
  pipelineQuestions,
  type PipelineQuestions,
} from '../../src/server/capabilities/sources/use-cases/pipeline-questions.js';

// M34 P4a end to end on a synthetic PDF (no owner file content): typed questions, a tag line,
// a printed key, an explanation chart, a pen note drawn in red, a film the stem points to, and
// a screenshot of another made-up bank's question.

/** A screenshot of `html` rendered at `width` × `height` CSS pixels, as a PNG data URL. */
async function picture(page: Page, html: string, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<body style="margin:0">${html}</body>`);
  const png = await page.screenshot({ clip: { x: 0, y: 0, width, height } });
  return `data:image/png;base64,${png.toString('base64')}`;
}

const TYPED = [
  '7. Which colour is the made-up flag in this example?',
  'a) Red',
  'b) Blue',
  'c) Green',
];

async function buildFixture(dir: string): Promise<string> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const card = TYPED.map((text) => `<div style="margin:8px 0">${text}</div>`).join('');
  const pictures: Record<string, string> = {
    typed: await picture(
      page,
      `<div style="font:28px 'Liberation Sans';padding:16px;background:#fff">${card}</div>`,
      900,
      260,
    ),
    film: await picture(
      page,
      '<div style="width:400px;height:300px;background:radial-gradient(circle at 40% 45%,#ddd,#777 30%,#222 60%,#000)"></div>',
      400,
      300,
    ),
    chart: await picture(
      page,
      '<div style="width:440px;height:240px;background:linear-gradient(90deg,#123 0,#468 30%,#9ab 60%,#234)"></div>',
      440,
      240,
    ),
  };
  const html = readFileSync(resolve('tests/fixtures/import/pipeline-q-basic.html'), 'utf8');
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.setContent(html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => pictures[key] ?? ''));
  const file = join(dir, 'pipeline-q-basic.pdf');
  await page.pdf({ path: file, format: 'A4', preferCSSPageSize: true, printBackground: true });
  await browser.close();
  return file;
}

let dir: string;
let result: PipelineQuestions;

beforeAll(async () => {
  process.env['OMP_THREAD_LIMIT'] ??= '1';
  dir = mkdtempSync(join(tmpdir(), 'qbank-pipeline-q-'));
  result = await pipelineQuestions(await buildFixture(dir));
}, 240_000);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const numbered = (number: number) =>
  result.questions.find((question) => question.number === number) as PipelineQuestion;
const places = (question: PipelineQuestion) =>
  question.pictures.map((picture) => `${picture.imageClass}:${picture.placement}`).sort();

describe('pipeline questions (no AI)', () => {
  it('reads the typed questions and the screenshot question, in order', () => {
    expect(result.questions.map((q) => [q.number, q.page, q.options.length])).toEqual([
      [1, 1, 3],
      [2, 1, 2],
      [7, 3, 3],
    ]);
    expect(result.questions.map((q) => q.fromPicture)).toEqual([false, false, true]);
    expect(numbered(7).stem).toContain('made-up flag');
  });

  it('takes the printed key and the tag line, and keeps the tag out of the text', () => {
    const first = numbered(1);
    expect(first.answers).toEqual(['B']);
    expect(first.evidence).toEqual(['printed_key']);
    expect(first.tags).toEqual({ exam: 'Part II', year: '2019' });
    expect(`${first.stem} ${first.explanation ?? ''}`).not.toContain('2019');
  });

  it('keeps explanation pictures and the pen note for after the reveal', () => {
    expect(places(numbered(1))).toEqual(['figure:explanation', 'handwriting_ink:explanation']);
    const note = numbered(1).pictures.find((p) => p.imageClass === 'handwriting_ink');
    expect(note?.unitId).toMatch(/^ink:1:\d+$/);
  });

  it('shows the film the stem points to with the question (D3.2)', () => {
    expect(places(numbered(2))).toEqual(['figure:question']);
  });

  it('gives no answer the file does not decide', () => {
    expect(numbered(2).answers).toEqual([]);
    expect(numbered(2).reviewReasons).toContain('no_answer');
    expect(numbered(7).answers).toEqual([]);
  });
});
