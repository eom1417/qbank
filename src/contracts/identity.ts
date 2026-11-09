import { z } from 'zod';

export const Locale = z.enum(['ar', 'en']);
export type Locale = z.infer<typeof Locale>;

const Theme = z.enum(['system', 'light', 'dark']);

/**
 * The look-and-feel skins (one engine, several experiences). This list is the single source:
 * adding a skin = its name here + `src/web/design-system/tokens/skins/<name>.css` + two labels.
 */
export const SKINS = ['clinic', 'calm', 'native', 'warm'] as const;
export const Skin = z.enum(SKINS);
export type Skin = z.infer<typeof Skin>;
export const DEFAULT_SKIN: Skin = 'clinic';
/** A stored skin that is no longer offered falls back to the default instead of failing. */
export const skinOf = (value: string): Skin => Skin.catch(DEFAULT_SKIN).parse(value);

/** When the source explanation is shown in Tutor mode (FR-22-001). */
const ExplanationMode = z.enum(['after_answer', 'on_request']);

const Email = z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(254));
const NewPassword = z.string().min(10).max(200);
const DisplayName = z.string().trim().min(1).max(80);
const SessionSize = z.number().int().min(1).max(200);
/** Reminders of due reviews: off unless the owner turns them on (FR-22-004, DEC-22). */
const ReviewReminders = z.enum(['off', 'daily', 'weekly']);

export const SignUpRequest = z.object({
  email: Email,
  password: NewPassword,
  displayName: DisplayName,
  locale: Locale,
  acceptTerms: z.literal(true),
});
export type SignUpRequest = z.infer<typeof SignUpRequest>;

export const SignInRequest = z.object({
  email: Email,
  password: z.string().min(1).max(200),
});
export type SignInRequest = z.infer<typeof SignInRequest>;

export const PasswordResetRequest = z.object({ email: Email });
export type PasswordResetRequest = z.infer<typeof PasswordResetRequest>;

export const PasswordResetConfirm = z.object({
  token: z.string().min(20).max(200),
  password: NewPassword,
});
export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirm>;

export const ChangePasswordRequest = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: NewPassword,
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequest>;

export const AccountPreferences = z
  .object({
    locale: Locale,
    theme: Theme,
    skin: Skin,
    defaultSessionSize: SessionSize,
    explanationMode: ExplanationMode,
    reviewReminders: ReviewReminders,
  })
  .strict();
export type AccountPreferences = z.infer<typeof AccountPreferences>;

/** Partial update: only the fields sent change; an empty body is rejected. */
export const UpdateAccountRequest = z
  .object({
    displayName: DisplayName,
    locale: Locale,
    theme: Theme,
    skin: Skin,
    defaultSessionSize: SessionSize,
    explanationMode: ExplanationMode,
    reviewReminders: ReviewReminders,
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'empty' });
export type UpdateAccountRequest = z.infer<typeof UpdateAccountRequest>;

export const AccountResponse = z
  .object({
    id: z.uuid(),
    email: z.string(),
    displayName: z.string(),
    preferences: AccountPreferences,
    /** The server's declared operator (DEC-40): set by QBANK_OPERATOR_EMAIL, never from the UI. */
    isOperator: z.boolean(),
  })
  .strict();
export type AccountResponse = z.infer<typeof AccountResponse>;

/** How this install runs: one local owner with paired browsers, or accounts (DEC-31). */
export const AppMode = z.enum(['local', 'accounts']);
export type AppMode = z.infer<typeof AppMode>;

/** `operatorName`: who runs this server, shown to every user (DEC-40); null on a local install. */
export const AppMetaResponse = z
  .object({ mode: AppMode, operatorName: z.string().nullable() })
  .strict();
export type AppMetaResponse = z.infer<typeof AppMetaResponse>;

/** Pairs this browser with a local install: by its pairing code, or by being the computer itself. */
export const PairRequest = z
  .object({ token: z.string().trim().min(1).max(200).optional(), locale: Locale.optional() })
  .strict();
export type PairRequest = z.infer<typeof PairRequest>;

/** The pairing code, shown only to an already paired browser (to open QBank on another device). */
/** The pairing code, and where a phone on the same network opens QBank (`--lan` only). */
export const PairingCodeResponse = z
  .object({ code: z.string(), lanOrigin: z.string().nullable() })
  .strict();
export type PairingCodeResponse = z.infer<typeof PairingCodeResponse>;
