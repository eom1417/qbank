import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  statSync,
  writeSync,
} from 'node:fs';
import { join } from 'node:path';

/** One log file at most this large; then it becomes `.1` and older ones move down. */
const MAX_BYTES = 5 * 1024 * 1024;
/** Old files kept beside the current one: the newest 25 MB of history at most. */
const KEEP = 4;

/**
 * QBank's own log on this computer (M17.3): `<dataDir>/logs/qbank.log`, rotated by size, also
 * written to the terminal. Request lines carry the path only, never a query or a body.
 */
export function createRotatingLog(dataDir: string) {
  const dir = join(dataDir, 'logs');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = join(dir, 'qbank.log');
  const name = (index: number) => (index === 0 ? file : `${file}.${index}`);
  let size = existsSync(file) ? statSync(file).size : 0;
  // Written in order, line by line: a local log is small, and a rotation never races a write.
  let out = openSync(file, 'a', 0o600);
  const rotate = () => {
    closeSync(out);
    rmSync(name(KEEP), { force: true });
    for (let index = KEEP - 1; index >= 0; index--)
      if (existsSync(name(index))) renameSync(name(index), name(index + 1));
    out = openSync(file, 'a', 0o600);
    size = 0;
  };
  return {
    file,
    write(line: string) {
      process.stdout.write(line);
      if (size + line.length > MAX_BYTES) rotate();
      writeSync(out, line);
      size += Buffer.byteLength(line);
    },
  };
}

export type RotatingLog = ReturnType<typeof createRotatingLog>;

/** A request as logged: method and path; the query may hold what someone searched for. */
export const requestForLog = (request: { method: string; url: string }) => ({
  method: request.method,
  path: request.url.split('?')[0],
});
