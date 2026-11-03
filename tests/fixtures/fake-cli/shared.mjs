// Shared bits of the fake Claude and Codex CLIs used by the tests (no network, no account).
import process from 'node:process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/** Server secrets that must never reach a provider CLI; their presence fails the run. */
export const SERVER_SECRETS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'OPENAI_API_KEY',
  'DATABASE_URL',
  'TEST_DATABASE_URL',
  'QBANK_MASTER_KEY',
];

export const leakedSecrets = () => SERVER_SECRETS.filter((name) => process.env[name]);

export const readJson = (file) =>
  existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;

export const writeJson = (file, value) =>
  writeFileSync(file, JSON.stringify(value), { mode: 0o600 });

/** What a model returns for the two tasks the app sends: the trial question or a mark. */
export function answerFor(schema, hasImage) {
  if (schema.includes('marked')) {
    return {
      marked: hasImage ? 'A' : null,
      mark: hasImage ? 'circle' : 'none',
      confident: hasImage,
    };
  }
  return {
    stem: 'Which electrolyte disturbance most typically produces peaked T waves on an ECG?',
    options: ['Hypokalemia', 'Hyperkalemia', 'Hypocalcemia', 'Hypomagnesemia'],
    answer: 'B',
  };
}

/** Reads stdin until a line ends (the pasted code) or the stream ends (a prompt). */
export function readInput(untilLine) {
  return new Promise((resolve) => {
    let text = '';
    process.stdin.on('data', (chunk) => {
      text += chunk.toString('utf8');
      if (untilLine && /[\r\n]/.test(text)) resolve(text.split(/[\r\n]/)[0].trim());
    });
    process.stdin.on('end', () => resolve(text));
  });
}

export const argAfter = (args, flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};
