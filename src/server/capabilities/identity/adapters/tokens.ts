import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Opaque bearer secret (session cookie, password-reset link); only its hash is stored. */
export const generateToken = (): string => randomBytes(32).toString('base64url');

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/** Compares two secrets in constant time (their hashes have equal length whatever the input). */
export const sameToken = (presented: string, expected: string): boolean =>
  timingSafeEqual(Buffer.from(hashToken(presented)), Buffer.from(hashToken(expected)));
