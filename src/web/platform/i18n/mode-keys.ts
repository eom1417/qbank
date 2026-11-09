import type { AppMode } from '../../../contracts/identity.js';
import { en, type MessageKey } from './catalog-en.js';

/** The suffix of a text's server variant (M31, B3): the base key keeps the local text. */
export const SERVER_SUFFIX = '.server';

const isKey = (key: string): key is MessageKey => key in en;

/**
 * The key a reader in this mode sees: on a server (accounts mode) the `.server` variant when the
 * text has one, otherwise the text itself. Unknown mode (still loading) reads the base text.
 */
export function modeKey(key: MessageKey, mode: AppMode | null): MessageKey {
  if (mode !== 'accounts') return key;
  const server = `${key}${SERVER_SUFFIX}`;
  return isKey(server) ? server : key;
}
