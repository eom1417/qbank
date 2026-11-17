const twoDigits = (n: number) => String(n).padStart(2, '0');

/**
 * The time left as a clock reads it (M34 U1): `29:54`, or `1:05:09` from an hour up. Western
 * digits in every language, as everywhere else in the app.
 */
export function clockText(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = twoDigits(total % 60);
  return hours > 0 ? `${hours}:${twoDigits(minutes)}:${rest}` : `${minutes}:${rest}`;
}
