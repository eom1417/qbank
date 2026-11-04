import { z } from 'zod';

/** What an export of this choice will hold, and what it never holds (UI-26, FR-18-006). */
export const ExportPreviewResponse = z
  .object({
    questions: z.number().int(),
    pictures: z.number().int(),
    notes: z.number().int(),
    chapters: z.number().int(),
    sources: z.number().int(),
    notIncluded: z.array(z.string()),
  })
  .strict();
export type ExportPreviewResponse = z.infer<typeof ExportPreviewResponse>;

/** What a restore brought back into a new bank (FR-18-005). */
export const RestoreResponse = z
  .object({
    bankId: z.uuid(),
    questions: z.number().int(),
    pictures: z.number().int(),
    /** Questions left out because their source was not in the file. */
    skipped: z.number().int(),
    /** Pictures the file names but does not hold: said, never hidden (FR-18-006). */
    missingPictures: z.number().int(),
  })
  .strict();
export type RestoreResponse = z.infer<typeof RestoreResponse>;

/** What deleting a bank takes with it, before the owner confirms (FR-19-005, UI-27). */
export const BankDeletionImpact = z
  .object({
    questions: z.number().int(),
    pictures: z.number().int(),
    sources: z.number().int(),
    notes: z.number().int(),
    sessions: z.number().int(),
    activeSessions: z.number().int(),
  })
  .strict();
export type BankDeletionImpact = z.infer<typeof BankDeletionImpact>;

export const ConfirmRequest = z.object({ confirm: z.literal(true) }).strict();

/** An account deletion step by step: nothing is said done before it is (FR-19-007, UAT-075). */
export const AccountDeletionResponse = z
  .object({
    complete: z.boolean(),
    steps: z.array(
      z.object({ step: z.enum(['banks', 'files', 'account']), done: z.boolean() }).strict(),
    ),
  })
  .strict();
export type AccountDeletionResponse = z.infer<typeof AccountDeletionResponse>;
