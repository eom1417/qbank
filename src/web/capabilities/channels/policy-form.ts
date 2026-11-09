import type { SharePolicy } from '../../../contracts/sharing.js';

/** The value `null` takes in a select, where every value is text. */
export const NONE = 'none';

/** A select's text back to its number, or null for "none". */
export const numberOrNull = (value: string): number | null =>
  value === NONE || value === '' ? null : Number(value);

/** The current value first among the offered ones, so a select can always show it. */
export function withCurrent(
  options: readonly (number | null)[],
  current: number | null,
): (number | null)[] {
  return options.includes(current) ? [...options] : [current, ...options];
}

const pad = (n: number) => String(n).padStart(2, '0');

/** An ISO instant as the reader's local `datetime-local` value (empty for none). */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `${day}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A `datetime-local` value (the reader's time) as an ISO instant; empty or broken is null. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/** Adds or removes one chapter from what is shared (none: the whole bank). */
export function toggleChapter(policy: SharePolicy, chapterId: string): SharePolicy {
  const ids = policy.content.chapterIds;
  const chapterIds = ids.includes(chapterId)
    ? ids.filter((id) => id !== chapterId)
    : [...ids, chapterId];
  return { ...policy, content: { ...policy.content, chapterIds } };
}

/** Who opens a people's share: anyone with the link, or the link and a code. */
export function withAccess(
  policy: SharePolicy,
  access: 'open' | 'code',
  code: string,
): SharePolicy {
  const askId = policy.audience.access === 'key' ? false : policy.audience.askId;
  const audience = access === 'code' ? { access, code, askId } : { access, askId };
  return { ...policy, audience };
}
