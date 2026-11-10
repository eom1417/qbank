/**
 * Google sign-in from the browser's side (M32, DEC-42). The server runs the whole OAuth flow:
 * the browser only leaves for its start route and comes back on `next`, or with `?error=`.
 */

/** Where the server sends the browser back after Google; only a path on this site is kept. */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  return next;
}

/** The server route that starts Google sign-in; sign-up adds the terms the person accepted. */
export function googleStartUrl(next: string, acceptTerms: boolean): string {
  const query = new URLSearchParams({ next: safeNext(next) });
  if (acceptTerms) query.set('acceptTerms', '1');
  return `/api/auth/google/start?${query.toString()}`;
}

/** Why the server sent the browser back to sign-in or sign-up, if it did. */
const GOOGLE_ERRORS = ['google', 'terms', 'too_many_attempts'] as const;
export type GoogleError = (typeof GOOGLE_ERRORS)[number];

export function googleError(search: string): GoogleError | null {
  const error = new URLSearchParams(search).get('error');
  return GOOGLE_ERRORS.find((known) => known === error) ?? null;
}
