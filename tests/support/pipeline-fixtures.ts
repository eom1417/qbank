import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, type Page } from '@playwright/test';
import { drawFigures } from './figures.js';

// Synthetic pictures for the M34 pipeline fixtures (no owner file content, no binary in git).
// Each function runs inside Chromium and returns a PNG data URL.

interface Lines {
  width: number;
  height: number;
  lines: string[];
  font: string;
  rtl: boolean;
}

/** Typed text on a white card, as a screenshot of another question bank looks. */
function typedCard({ width, height, lines, font, rtl }: Lines) {
  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = [width, height];
  const c = canvas.getContext('2d') as CanvasRenderingContext2D;
  c.fillStyle = '#fff';
  c.fillRect(0, 0, width, height);
  c.fillStyle = '#111';
  c.font = font;
  c.direction = rtl ? 'rtl' : 'ltr';
  c.textAlign = rtl ? 'right' : 'left';
  lines.forEach((line, row) => c.fillText(line, rtl ? width - 20 : 20, 40 + row * 38));
  return canvas.toDataURL('image/png');
}

interface Pen {
  width: number;
  height: number;
  color: string;
  words: string;
}

/** A pen note in a slanted script on white paper. */
function penNote({ width, height, color, words }: Pen) {
  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = [width, height];
  const c = canvas.getContext('2d') as CanvasRenderingContext2D;
  c.fillStyle = '#fff';
  c.fillRect(0, 0, width, height);
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 3;
  c.translate(12, height * 0.7);
  c.rotate(-0.06);
  c.font = 'italic 34px "DejaVu Serif", cursive';
  c.fillText(words, 0, 0);
  c.beginPath();
  c.moveTo(0, 12);
  c.bezierCurveTo(width * 0.3, 22, width * 0.6, 4, width * 0.85, 16);
  c.stroke();
  return canvas.toDataURL('image/png');
}

type Mark = 'circle' | 'cross' | 'highlight';

/** Marks on a transparent layer: a red hand circle, a red ✗, a yellow highlighter stroke. */
function mark(kind: Mark) {
  const canvas = document.createElement('canvas');
  const sizes: Record<Mark, [number, number]> = {
    circle: [80, 60],
    cross: [52, 52],
    highlight: [300, 44],
  };
  [canvas.width, canvas.height] = sizes[kind];
  const c = canvas.getContext('2d') as CanvasRenderingContext2D;
  c.strokeStyle = '#d61f1f';
  c.lineWidth = 5;
  c.beginPath();
  if (kind === 'circle') c.ellipse(40, 30, 34, 24, 0.1, 0.2, Math.PI * 2.1);
  if (kind === 'cross') {
    c.moveTo(6, 6);
    c.lineTo(46, 46);
    c.moveTo(46, 6);
    c.lineTo(8, 44);
  }
  if (kind === 'highlight') {
    c.fillStyle = 'rgba(255, 230, 0, 0.5)';
    c.fillRect(0, 0, 300, 44);
  } else c.stroke();
  return canvas.toDataURL('image/png');
}

/** A ruled table of short cells. */
function grid() {
  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = [840, 300];
  const c = canvas.getContext('2d') as CanvasRenderingContext2D;
  c.fillStyle = '#fff';
  c.fillRect(0, 0, 840, 300);
  c.strokeStyle = '#000';
  c.lineWidth = 3;
  c.beginPath();
  for (let y = 2; y <= 300; y += 74) {
    c.moveTo(0, y);
    c.lineTo(840, y);
  }
  for (let x = 2; x <= 840; x += 209) {
    c.moveTo(x, 0);
    c.lineTo(x, 300);
  }
  c.stroke();
  c.fillStyle = '#000';
  c.font = '26px "Liberation Sans"';
  const cells = ['Drug', 'Dose', 'Route', 'Times', 'Alpha', '10 mg', 'Oral', 'Daily'];
  cells.forEach((cell, i) => c.fillText(cell, 20 + (i % 4) * 209, 48 + Math.floor(i / 4) * 74));
  return canvas.toDataURL('image/png');
}

type Ornament = 'logo' | 'frame' | 'watermark' | 'bar';

/** Decoration: a logo, a page frame, a faint watermark, a thin bar. */
function ornament(kind: Ornament) {
  const canvas = document.createElement('canvas');
  const sizes: Record<Ornament, [number, number]> = {
    logo: [120, 120],
    frame: [794, 1122],
    watermark: [794, 1122],
    bar: [500, 4],
  };
  [canvas.width, canvas.height] = sizes[kind];
  const c = canvas.getContext('2d') as CanvasRenderingContext2D;
  const draw: Record<Ornament, () => void> = {
    logo: () => {
      c.fillStyle = '#1d4e89';
      c.arc(60, 60, 56, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.fillStyle = '#fff';
      c.moveTo(60, 20);
      c.lineTo(100, 90);
      c.lineTo(20, 90);
      c.fill();
    },
    frame: () => {
      c.strokeStyle = '#223344';
      c.lineWidth = 4;
      c.strokeRect(20, 20, 754, 1082);
    },
    watermark: () => {
      c.fillStyle = 'rgba(120, 120, 120, 0.12)';
      c.font = 'bold 160px "Liberation Sans"';
      c.translate(397, 561);
      c.rotate(-0.8);
      c.textAlign = 'center';
      c.fillText('DRAFT', 0, 0);
    },
    bar: () => {
      c.fillStyle = '#7a8a9a';
      c.fillRect(0, 0, 500, 4);
    },
  };
  draw[kind]();
  return canvas.toDataURL('image/png');
}

const ENGLISH_CARD = [
  '23. A made-up patient has hives after a snack.',
  'Which treatment comes first in this example?',
  'A. Oral antihistamine',
  'B. Intramuscular adrenaline',
  'C. Observation only',
];
const ARABIC_CARD = ['السؤال 7: ما العلاج الأول في هذا المثال؟', 'أ. دواء أول', 'ب. دواء ثان'];

async function drawPictures(page: Page): Promise<Record<string, string>> {
  const figures = await drawFigures(page);
  const font = '30px "Liberation Sans"';
  const card = (lines: string[], rtl: boolean, card = font) =>
    page.evaluate(typedCard, {
      width: 960,
      height: 60 + lines.length * 38,
      lines,
      font: card,
      rtl,
    });
  return {
    xray: figures['xray'] ?? '',
    rash: figures['rash'] ?? '',
    ecg: figures['ecg'] ?? '',
    strip: figures['echo'] ?? '',
    typed: await card(ENGLISH_CARD, false),
    arabicTyped: await card(ARABIC_CARD, true, '32px "Noto Naskh Arabic"'),
    note: await page.evaluate(penNote, {
      width: 520,
      height: 140,
      color: '#c81e1e',
      words: 'see dose',
    }),
    blueNote: await page.evaluate(penNote, {
      width: 480,
      height: 140,
      color: '#1e3cc8',
      words: 'recheck',
    }),
    circle: await page.evaluate(mark, 'circle' as const),
    cross: await page.evaluate(mark, 'cross' as const),
    highlight: await page.evaluate(mark, 'highlight' as const),
    table: await page.evaluate(grid),
    logo: await page.evaluate(ornament, 'logo' as const),
    frame: await page.evaluate(ornament, 'frame' as const),
    watermark: await page.evaluate(ornament, 'watermark' as const),
    bar: await page.evaluate(ornament, 'bar' as const),
  };
}

/**
 * Prints the pipeline fixture (tests/fixtures/import/pipeline-units.html) as a text PDF, and the
 * English typed fixture as a scan (one picture per page, no text layer).
 */
export async function buildPipelineFixtures() {
  const dir = mkdtempSync(join(tmpdir(), 'qbank-pipeline-'));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pictures = await drawPictures(page);
  const html = readFileSync(resolve('tests/fixtures/import/pipeline-units.html'), 'utf8');
  await page.setContent(html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => pictures[key] ?? ''));
  const units = join(dir, 'pipeline-units.pdf');
  await page.pdf({ path: units, format: 'A4', preferCSSPageSize: true });
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.setContent(readFileSync(resolve('tests/fixtures/import/english.html'), 'utf8'));
  const shot = (await page.screenshot()).toString('base64');
  await page.setContent(`<img src="data:image/png;base64,${shot}" style="width:100%">`);
  const scanned = join(dir, 'pipeline-scanned.pdf');
  await page.pdf({ path: scanned, format: 'A4', printBackground: true });
  await browser.close();
  return { units, scanned, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** A synthetic RGB image: `colour(x, y)` gives each pixel's red, green and blue. */
export function paint(
  width: number,
  height: number,
  colour: (x: number, y: number) => readonly [number, number, number],
) {
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data.set(colour(x, y), (y * width + x) * 3);
  return { width, height, data };
}
