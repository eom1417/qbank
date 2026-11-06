// Prints the sample bank (samples/sample-bank.html) to samples/sample-bank.pdf (M28.1): the bank a
// new owner studies in two minutes. Run after editing the HTML: `node scripts/make-sample.mjs`.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const html = resolve(import.meta.dirname, '../samples/sample-bank.html');
const pdf = resolve(import.meta.dirname, '../samples/sample-bank.pdf');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(readFileSync(html, 'utf8'));
await page.pdf({ path: pdf, format: 'A4', preferCSSPageSize: true });
await browser.close();
