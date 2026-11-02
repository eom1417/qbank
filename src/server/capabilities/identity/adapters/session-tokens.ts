import { createHash, randomBytes } from 'node:crypto';

/** Opaque bearer token sent to the browser; only its hash is stored. */
export const generateSessionToken = (): string => randomBytes(32).toString('base64url');

export const hashSessionToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
