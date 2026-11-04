import { z } from 'zod';

/** The system health card (M17.3): each part's state, and what needs attention. */
export const HealthResponse = z
  .object({
    aiHost: z.enum(['reachable', 'unreachable', 'not_configured']),
    aiReady: z.number().int(),
    diskFreeBytes: z.number().nullable(),
    backups: z.boolean(),
    lastBackupAt: z.string().nullable(),
    lastFailedImport: z
      .object({ fileName: z.string(), stage: z.string(), at: z.string().nullable() })
      .nullable(),
    logFile: z.string().nullable(),
    problems: z.array(z.enum(['ai_unreachable', 'disk_low', 'backup_old', 'import_failed'])),
  })
  .strict();
export type HealthResponse = z.infer<typeof HealthResponse>;
