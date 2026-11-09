import type { Locale } from '../../../../contracts/identity.js';

const RESET_TTL_MINUTES = 60;

export const resetExpiresAt = (now: Date): Date =>
  new Date(now.getTime() + RESET_TTL_MINUTES * 60 * 1000);

const TEXT: Record<Locale, { subject: string; body: (link: string) => string }> = {
  ar: {
    subject: 'إعادة تعيين كلمة المرور في محرك بنك الأسئلة',
    body: (link) =>
      `طلبت إعادة تعيين كلمة المرور. افتح الرابط خلال ${RESET_TTL_MINUTES} دقيقة:\n${link}\n\n` +
      'إن لم تطلب ذلك فتجاهل هذه الرسالة؛ كلمة مرورك الحالية لم تتغير.',
  },
  en: {
    subject: 'Reset your QBank Engine password',
    body: (link) =>
      `You asked to reset your password. Open this link within ${RESET_TTL_MINUTES} minutes:\n` +
      `${link}\n\nIf you did not ask for this, ignore this e-mail; your password is unchanged.`,
  },
};

/** The page that sets a new password. The token travels in the URL fragment, never to a server. */
export const resetLink = (appOrigin: string, token: string): string =>
  `${appOrigin}/reset-password#token=${token}`;

/** The token of the reset link written in a message, if it has one. */
export const resetTokenIn = (text: string): string | null =>
  /\/reset-password#token=([\w-]+)/.exec(text)?.[1] ?? null;

/** The reset e-mail in the account's own language. */
export function resetEmail(locale: Locale, appOrigin: string, token: string) {
  const link = resetLink(appOrigin, token);
  return { subject: TEXT[locale].subject, text: TEXT[locale].body(link) };
}
