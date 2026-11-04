import type { MessageKey } from '../../platform/i18n/i18n.js';
import { reviewEn } from '../../platform/i18n/catalog-review-en.js';

const known = (key: string): key is MessageKey => key in reviewEn;

/** A review reason's words; an unknown code (from a newer server) is shown as it is. */
export function reasonLabel(t: (key: MessageKey) => string, reason: string): string {
  const key = `review.reason.${reason}`;
  return known(key) ? t(key) : reason;
}

/** What made a version; `restore:<n>` is an earlier version brought back. */
export function originLabel(t: (key: MessageKey) => string, origin: string): string {
  const key = origin.startsWith('restore:')
    ? 'editor.history.origin.undo'
    : `editor.history.origin.${origin}`;
  return known(key) ? t(key) : origin;
}
