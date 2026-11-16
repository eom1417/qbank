import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { TruthFile, toReference } from './truth.js';

// M34 P0 step 6: `node --import tsx …/truth-samples.ts <corpusDir> <outDir> <truth.json>…`
// Turns approved ground truth into the benchmark's samples (`<slug>.pdf` + `<slug>.answers.json`),
// so `npm run bench:extraction -- <outDir>` measures today's import against it.

const [corpus = '', out = '', ...truths] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
for (const path of truths) {
  const truth = TruthFile.parse(JSON.parse(readFileSync(path, 'utf8')));
  const slug = basename(path).replace(/\.truth\.json$/, '');
  const pdf = join(out, `${slug}.pdf`);
  if (!existsSync(pdf)) symlinkSync(join(corpus, truth.file), pdf);
  writeFileSync(join(out, `${slug}.answers.json`), JSON.stringify(toReference(truth), null, 2));
  console.log(`${slug}: ${truth.questions.length} questions`);
}
