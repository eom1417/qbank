/**
 * Step 3: run every job against each model and write results.json + results.md.
 *
 *   node --import tsx src/server/tools/vision-cost/run.ts --out <dir> [--via cli|api] \
 *     [--models claude-haiku-5-5,claude-opus-5-5] [--max-calls 380] [--dry]
 *
 * `--via cli` (default) uses the logged-in `claude` CLI. `--via api` reads credentials from stdin
 * as NAME=value lines so they never reach argv or logs:
 *   { printf 'ANTHROPIC_API_KEY=%s\n' "$ANTHROPIC_API_KEY"; } | node ... run.ts --via api ...
 * `--dry` makes no call and records estimated input tokens only.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AnthropicCredentials } from './anthropic-provider.js';
import type { KeyEntry, Manifest, Sheet } from './bench-data.js';
import { callJob, estimateJob, makeSender, measureOverhead, type Via } from './bench-call.js';
import { buildJobs, type Job } from './jobs.js';
import { argValue, readJson, writeJson } from './shell.js';
import { renderTable, summarize, type CallRecord } from './stats.js';

const CONCURRENCY = 4;

/** NAME=value lines to credentials; unknown names are ignored. */
export function parseCredentials(text: string): AnthropicCredentials {
  const values = new Map<string, string>();
  for (const line of text.split('\n')) {
    const at = line.indexOf('=');
    if (at > 0) values.set(line.slice(0, at).trim(), line.slice(at + 1).trim());
  }
  const pick = (name: string): string | undefined => values.get(name) || undefined;
  return {
    apiKey: pick('ANTHROPIC_API_KEY'),
    authToken: pick('ANTHROPIC_AUTH_TOKEN'),
    baseUrl: pick('ANTHROPIC_BASE_URL'),
  };
}

interface ModelRun {
  records: CallRecord[];
  overhead: { inputTokens: number; cacheCreation: number; cacheRead: number };
}

async function runModel(via: Via, model: string, jobs: readonly Job[], credentials: AnthropicCredentials): Promise<ModelRun> {
  const send = makeSender(via, model, credentials);
  const overhead = await measureOverhead(send);
  const records: CallRecord[] = [];
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const batch = jobs.slice(i, i + CONCURRENCY).map((job) => callJob(send, job, model));
    records.push(...(await Promise.all(batch)));
    console.error(`${model}: ${records.length}/${jobs.length}`);
    const failed = records.filter((r) => r.failure !== null).length;
    if (failed >= CONCURRENCY && failed === records.length) break;
  }
  return { records, overhead };
}

async function main(argv: readonly string[]): Promise<void> {
  const out = argValue(argv, 'out', '');
  const via = argValue(argv, 'via', 'cli') === 'api' ? 'api' : 'cli';
  const models = argValue(argv, 'models', 'claude-haiku-5-5,claude-opus-5-5').split(',');
  const maxCalls = Number(argValue(argv, 'max-calls', '380'));
  const dry = argv.includes('--dry');
  const key = readJson<{ entries: KeyEntry[] }>(join(out, 'key.json')).entries;
  const jobs = buildJobs(readJson<Manifest>(join(out, 'manifest.json')), key, readJson<Sheet[]>(join(out, 'sheets.json')));
  if ((jobs.length + 1) * models.length > maxCalls) throw new Error('planned calls exceed --max-calls');
  const credentials = dry || via === 'cli' ? {} : parseCredentials(readFileSync(0, 'utf8'));
  const records: CallRecord[] = [];
  const overheads: Record<string, ModelRun['overhead']> = {};
  for (const model of models) {
    const run = dry ? null : await runModel(via, model, jobs, credentials);
    records.push(...(run ? run.records : jobs.map((job) => estimateJob(job, model))));
    if (run) overheads[model] = run.overhead;
  }
  const perCall = Object.fromEntries(Object.entries(overheads).map(([m, o]) => [m, o.inputTokens]));
  const table = summarize(records, perCall);
  writeJson(join(out, 'results.json'), { generatedAt: new Date().toISOString(), via, dry, effort: 'low', overheads, table, records });
  const overheadLine = Object.entries(perCall).map(([m, t]) => `${m}: ${t} input tokens per call`).join('; ');
  writeFileSync(join(out, 'results.md'), `${renderTable(table)}\n\nFixed overhead (text-only turn): ${overheadLine}\n`);
  console.log(renderTable(table));
  console.log(`overhead: ${overheadLine}`);
}

if (process.argv[1]?.endsWith('run.ts')) await main(process.argv.slice(2));
