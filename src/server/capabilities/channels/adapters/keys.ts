import { createHash, randomBytes } from 'node:crypto';

/** A channel's key: shown once to its owner, then only its hash is kept (DEC-36). */
export function newChannelKey() {
  const key = `qbc_${randomBytes(32).toString('base64url')}`;
  return { key, hash: hashOf(key), prefix: key.slice(0, 10) };
}

export const hashOf = (secret: string) => createHash('sha256').update(secret).digest('hex');

/** A presented key, if the header holds one of the channel key's shape. */
export function keyIn(authorization: string | undefined): string | null {
  const match = /^Bearer (qbc_[A-Za-z0-9_-]{43})$/.exec(authorization ?? '');
  return match?.[1] ?? null;
}
