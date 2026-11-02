import { z } from 'zod';

/** Local mail outbox (DEC-28): what the app would have e-mailed, for local testing only. */
export const OutboxResponse = z
  .object({
    messages: z.array(
      z
        .object({
          id: z.uuid(),
          to: z.string(),
          subject: z.string(),
          text: z.string(),
          createdAt: z.iso.datetime(),
        })
        .strict(),
    ),
  })
  .strict();
export type OutboxResponse = z.infer<typeof OutboxResponse>;
