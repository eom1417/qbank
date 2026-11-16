import { readFileSync } from 'node:fs';
import { TruthFile } from './truth.js';
import { checkTruth } from './truth-check.js';

// M34 P0 step 4: `node --import tsx src/server/tools/extraction-bench/truth-main.ts <truth.json>…`
// Prints every schema error and consistency problem; exits 1 if any file has one.

let failed = false;
for (const path of process.argv.slice(2)) {
  const parsed = TruthFile.safeParse(JSON.parse(readFileSync(path, 'utf8')));
  const problems = parsed.success
    ? checkTruth(parsed.data)
    : parsed.error.issues.map((issue) => `schema ${issue.path.join('.')}: ${issue.message}`);
  const questions = parsed.success ? parsed.data.questions.length : 0;
  console.log(`${path}: ${problems.length === 0 ? 'OK' : 'FAIL'} (${questions} questions)`);
  for (const problem of problems) console.log(`  ${problem}`);
  failed ||= problems.length > 0;
}
process.exit(failed ? 1 : 0);
