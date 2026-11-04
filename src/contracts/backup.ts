import { z } from 'zod';

/** What a person recognises in a backup, or in this install now. */
const Summary = z.object({
  banks: z.number().int(),
  questions: z.number().int(),
  sessions: z.number().int(),
  pictures: z.number().int(),
});

/** One full backup of this install (M17.2): when, why, how big, what it holds. */
const BackupView = Summary.extend({
  id: z.string(),
  createdAt: z.string(),
  reason: z.enum(['daily', 'manual', 'before_restore']),
  sizeBytes: z.number().int(),
}).strict();

export const BackupListResponse = z.object({ backups: z.array(BackupView) }).strict();
export type BackupListResponse = z.infer<typeof BackupListResponse>;

export const BackupCreatedResponse = z.object({ id: z.string() }).strict();

/** Before a restore: what comes back, what is here now, and whether this QBank can take it. */
export const RestorePreviewResponse = z
  .object({ createdAt: z.string(), backup: Summary, now: Summary, compatible: z.boolean() })
  .strict();
export type RestorePreviewResponse = z.infer<typeof RestorePreviewResponse>;

export const RestoreBackupResponse = z
  .object({ restored: z.string(), safety: z.string() })
  .strict();
