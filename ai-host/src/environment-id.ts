import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * The install's stable id (INTEGRATION_GUIDE §4): Codex ChatGPT sign-in binds tokens to it, so a
 * new id on every start would sign the user out. Created once, then read back.
 */
export function persistedEnvironmentId(home: string): string {
  const file = join(home, 'environment-id');
  try {
    const stored = readFileSync(file, 'utf8').trim();
    if (UUID.test(stored)) return stored;
  } catch {
    // First start: no id yet.
  }
  mkdirSync(home, { recursive: true, mode: 0o700 });
  const id = randomUUID();
  writeFileSync(file, `${id}\n`, { mode: 0o600 });
  return id;
}
