import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateToken } from './tokens.js';

/**
 * The secret that pairs another browser (a phone, a second computer) with this local install.
 * Created once in the data directory, readable only by its owner; deleting the file and
 * restarting issues a new one (existing paired browsers keep their sessions).
 */
export function loadPairingToken(dataDir: string): string {
  const file = join(dataDir, 'pairing-token');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const token = generateToken();
  writeFileSync(file, `${token}\n`, { mode: 0o600, flag: 'wx' });
  return token;
}
