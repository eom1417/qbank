import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
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

/** Replaces the saved code (written beside it, then renamed, so it is never half-written). */
export function savePairingToken(dataDir: string, token: string) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const file = join(dataDir, 'pairing-token');
  writeFileSync(`${file}.new`, `${token}\n`, { mode: 0o600 });
  renameSync(`${file}.new`, file);
}

/** The install's pairing code now; `replace` issues a new one, and the old one stops working. */
export interface PairingCode {
  current(): string;
  replace(): string;
}

export function createPairingCode(initial: string, save: (token: string) => void): PairingCode {
  let code = initial;
  return {
    current: () => code,
    replace: () => {
      code = generateToken();
      save(code);
      return code;
    },
  };
}
