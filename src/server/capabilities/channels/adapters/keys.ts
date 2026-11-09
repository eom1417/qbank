import { createHash, randomBytes } from 'node:crypto';

/**
 * The secrets of governed sharing (DEC-36, DEC-39), each shown once and kept only as a hash:
 * an agent's key `qbc_`, an exam/practice link `qbt_`, a person's attempt `qba_`.
 */
export type SecretPrefix = 'qbc_' | 'qbt_' | 'qba_';

export function newSecret(prefix: SecretPrefix) {
  const secret = `${prefix}${randomBytes(32).toString('base64url')}`;
  return { secret, hash: hashOf(secret), prefix: secret.slice(0, 10) };
}

export const hashOf = (secret: string) => createHash('sha256').update(secret).digest('hex');

const SHAPE = /^(qb[cta]_[A-Za-z0-9_-]{43})$/;

/** A secret of the given kind, if the value has its exact shape. */
export function secretOf(value: string | undefined, prefix: SecretPrefix): string | null {
  const match = SHAPE.exec(value ?? '');
  return match?.[1]?.startsWith(prefix) ? match[1] : null;
}

/** A bearer secret of the given kind from an `Authorization` header. */
export const bearerOf = (authorization: string | undefined, prefix: SecretPrefix) =>
  secretOf(/^Bearer (.+)$/.exec(authorization ?? '')?.[1], prefix);

/** A presented channel key, if the header holds one of the channel key's shape. */
export const keyIn = (authorization: string | undefined) => bearerOf(authorization, 'qbc_');
