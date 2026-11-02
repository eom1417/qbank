import { z } from 'zod';

export const Locale = z.enum(['ar', 'en']);
export type Locale = z.infer<typeof Locale>;

export const Theme = z.enum(['system', 'light', 'dark']);
export type Theme = z.infer<typeof Theme>;

const Email = z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(254));

const PASSWORD_MIN_LENGTH = 10;

export const SignUpRequest = z.object({
  email: Email,
  password: z.string().min(PASSWORD_MIN_LENGTH).max(200),
  displayName: z.string().trim().min(1).max(80),
  locale: Locale,
  acceptTerms: z.literal(true),
});
export type SignUpRequest = z.infer<typeof SignUpRequest>;

export const SignInRequest = z.object({
  email: Email,
  password: z.string().min(1).max(200),
});
export type SignInRequest = z.infer<typeof SignInRequest>;

export const AccountResponse = z
  .object({
    id: z.uuid(),
    email: z.string(),
    displayName: z.string(),
    locale: Locale,
    theme: Theme,
  })
  .strict();
export type AccountResponse = z.infer<typeof AccountResponse>;
