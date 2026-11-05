import { readFileSync, writeFileSync } from 'node:fs';
import { kitProvider } from '../../capabilities/providers/index.js';
import { triageAnswers, type TriageItem } from '../../capabilities/sources/index.js';
import { createAiHostClient } from '../../platform/ai-host/client.js';
import { loadBenchAiHost } from '../../platform/config/index.js';
import { tally, type BenchQuestion } from './score.js';

// Answer benchmark (M19.2): `npm run bench:answers -- <dataset.json> --ai=<instance>
// [--first=<model>] [--second=<model>] [--judge=<model>]`. The dataset is a JSON array of
// questions with the file's answer; the solvers never see it. The report says how often the
// triage agrees with the file, and lists every question it would settle differently.
const args = process.argv.slice(2);
const flag = (name: string) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const [dataset] = args.filter((arg) => !arg.startsWith('--'));
const instance = flag('ai');
const host = loadBenchAiHost();
if (!dataset || !instance || !host) {
  console.error('usage: bench:answers <dataset.json> --ai=<instance> (needs QBANK_AI_HOST_TOKEN)');
  process.exit(2);
}
const client = createAiHostClient(host);
const role = (model: string | undefined) =>
  kitProvider(client, 'bench', { instanceId: instance, ...(model ? { model } : {}) });

const questions = JSON.parse(readFileSync(dataset, 'utf8')) as BenchQuestion[];
const items: TriageItem[] = questions.map((question, index) => ({
  question: { id: `q${index + 1}`, stem: question.stem, options: question.options },
  file: question.answer,
  added: new Set(),
}));
const started = Date.now();
const result = await triageAnswers(items, {
  first: role(flag('first')),
  second: role(flag('second')),
  judge: role(flag('judge')),
});
const report = tally(questions, items, result.byId);
console.log(
  JSON.stringify(
    { ...report.summary, failure: result.failure, seconds: (Date.now() - started) / 1000 },
    null,
    2,
  ),
);
writeFileSync(`${dataset}.report.json`, JSON.stringify(report, null, 2));
