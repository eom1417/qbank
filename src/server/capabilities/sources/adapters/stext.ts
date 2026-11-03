import type { PageText, PageWord } from '../domain/page.js';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

const unescapeXml = (value: string) =>
  value.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, code: string) => {
    if (code.startsWith('#x')) return String.fromCodePoint(parseInt(code.slice(2), 16));
    if (code.startsWith('#')) return String.fromCodePoint(Number(code.slice(1)));
    return ENTITIES[code] ?? whole;
  });

const attr = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? '';

interface Glyph {
  c: string;
  font: string;
  xs: number[];
  ys: number[];
}

function toWords(glyphs: readonly Glyph[]): PageWord[] {
  const words: PageWord[] = [];
  let run: Glyph[] = [];
  const flush = () => {
    if (run.length === 0) return;
    const xs = run.flatMap((g) => g.xs);
    const ys = run.flatMap((g) => g.ys);
    const box = {
      x0: Math.min(...xs),
      y0: Math.min(...ys),
      x1: Math.max(...xs),
      y1: Math.max(...ys),
    };
    words.push({ text: run.map((g) => g.c).join(''), box, font: run[0]?.font ?? null });
    run = [];
  };
  for (const glyph of glyphs) {
    if (glyph.c.trim() === '') flush();
    else run.push(glyph);
  }
  flush();
  return words;
}

function lineGlyphs(lineBody: string): Glyph[] {
  const glyphs: Glyph[] = [];
  for (const [, fontTag = '', fontBody = ''] of lineBody.matchAll(
    /<font\b([^>]*)>([\s\S]*?)<\/font>/g,
  )) {
    const font = attr(fontTag, 'name');
    for (const [charTag = ''] of fontBody.matchAll(/<char\b[^>]*\/>/g)) {
      const quad = attr(charTag, 'quad').split(' ').map(Number);
      const xs = quad.filter((_, i) => i % 2 === 0);
      const ys = quad.filter((_, i) => i % 2 === 1);
      glyphs.push({ c: unescapeXml(attr(charTag, 'c')), font, xs, ys });
    }
  }
  return glyphs;
}

/** Parses MuPDF structured text (`mutool draw -F stext`): words with boxes and font names. */
export function parseStext(xml: string): PageText[] {
  const pages: PageText[] = [];
  for (const [, pageTag = '', body = ''] of xml.matchAll(/<page\b([^>]*)>([\s\S]*?)<\/page>/g)) {
    const words = [...body.matchAll(/<line\b[^>]*>([\s\S]*?)<\/line>/g)].flatMap(
      ([, lineBody = '']) => toWords(lineGlyphs(lineBody)),
    );
    const width = Number(attr(pageTag, 'width'));
    const height = Number(attr(pageTag, 'height'));
    pages.push({ page: pages.length + 1, width, height, words });
  }
  return pages;
}
