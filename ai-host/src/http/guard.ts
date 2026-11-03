import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

/** Only QBank's server, on this machine, with the shared token, may call the AI host. */
export function allowed(request: IncomingMessage, token: string, port: number): boolean {
  const host = request.headers.host ?? '';
  // A browser tricked into calling the port (DNS rebinding) sends another Host.
  if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return false;
  const given = Buffer.from(request.headers.authorization ?? '');
  const expected = Buffer.from(`Bearer ${token}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** The QBank session that makes the call; sign-in flows belong to it (INTEGRATION_GUIDE §6). */
export function ownerSessionOf(request: IncomingMessage): string | null {
  const owner = request.headers['x-owner-session'];
  return typeof owner === 'string' && owner.length > 0 && owner.length <= 200 ? owner : null;
}

const MAX_BODY_BYTES = 1024 * 1024;

/** A JSON request body, at most 1 MiB; null when it is not JSON. */
export async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) return null;
    chunks.push(chunk as Buffer);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    return null;
  }
}
