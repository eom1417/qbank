// Draws the app icons (PNG) from src/web/public/icon.svg with the browser the tests already use.
// Run after changing the SVG: `node scripts/make-icons.mjs`. The PNGs are committed.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PUBLIC = resolve(import.meta.dirname, '../src/web/public');
const svg = readFileSync(resolve(PUBLIC, 'icon.svg'), 'utf8');
const browser = await chromium.launch();
for (const size of [180, 192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  await page.screenshot({ path: resolve(PUBLIC, `icon-${size}.png`), omitBackground: true });
  await page.close();
}
await browser.close();
