// A running QBank, checked the way its owner first uses it (M25): `node scripts/smoke.mjs [url]`.
// It waits for the app, pairs as this computer (no code), makes a bank, imports a small PDF of
// eight questions and waits until all of them are read. Exit 0 only when all of it worked.
// `--after-upgrade`: first checks that the bank of an earlier run (an earlier version) is still
// there, with its questions, before doing it all again.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import console from 'node:console';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';

const { fetch, FormData, Blob } = globalThis;
const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const PDF = resolve(import.meta.dirname, '../tests/fixtures/smoke/questions.pdf');
/** The questions in tests/fixtures/smoke/questions.pdf (made from tests/fixtures/import/english.html). */
const QUESTIONS = 8;
const DONE = new Set(['completed', 'needs_review', 'partial_failure', 'failed', 'cancelled']);
let cookie = '';

async function call(method, path, body) {
  const headers = { origin: BASE, ...(cookie ? { cookie } : {}) };
  const init = { method, headers };
  if (body instanceof FormData) init.body = body;
  else if (body) {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${BASE}${path}`, init);
  const set = response.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

async function waitUntilUp(seconds) {
  for (let i = 0; i < seconds; i += 1) {
    const ok = await fetch(`${BASE}/api/health`).then(
      (r) => r.ok,
      () => false,
    );
    if (ok) return;
    await sleep(1000);
  }
  throw new Error(`no answer from ${BASE}/api/health after ${seconds} s`);
}

async function importPdf(bankId) {
  const form = new FormData();
  form.set('rightsConfirmed', 'true');
  form.set('file', new Blob([readFileSync(PDF)], { type: 'application/pdf' }), 'questions.pdf');
  const started = await call('POST', `/api/banks/${bankId}/imports`, form);
  for (let i = 0; i < 120; i += 1) {
    const job = await call('GET', `/api/imports/${started.id}`);
    if (DONE.has(job.stage)) return job;
    await sleep(1000);
  }
  throw new Error('the import did not finish in 2 minutes');
}

/** After an upgrade: the earlier version's bank and its questions are all still there. */
async function earlierBankKept() {
  const { banks } = await call('GET', '/api/banks');
  const earlier = banks.find((bank) => bank.name === 'Smoke check');
  if (!earlier) throw new Error('the bank made before the upgrade is gone');
  const summary = await call('GET', `/api/analytics/summary?bankId=${earlier.id}`);
  if (summary.questions.total !== QUESTIONS)
    throw new Error(`the earlier bank holds ${summary.questions.total} of ${QUESTIONS} questions`);
  console.log(`PASS: the bank made before the upgrade is kept, with its ${QUESTIONS} questions`);
}

async function main() {
  await waitUntilUp(Number(process.env.SMOKE_WAIT_SECONDS ?? 180));
  console.log('PASS: QBank answers');
  await call('POST', '/api/local/pair', {});
  console.log('PASS: this computer paired with no code');
  if (process.argv.includes('--after-upgrade')) await earlierBankKept();
  const bank = await call('POST', '/api/banks', { name: 'Smoke check' });
  const job = await importPdf(bank.id);
  if (job.questionsFound !== QUESTIONS)
    throw new Error(`read ${job.questionsFound} of ${QUESTIONS} questions (${job.stage})`);
  console.log(`PASS: a PDF imported, ${job.questionsFound} questions read (${job.stage})`);
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
