import { z } from 'zod';

/** A remaining capture defect, located in the source even when no question owns it. */
export const DetectionIssue = z
  .object({
    check: z.string(),
    question: z.number().int().nullable(),
    pages: z.array(z.number().int().positive()),
    lines: z.array(z.number().int().positive()),
    detail: z.string(),
  })
  .strict();
export type DetectionIssue = z.infer<typeof DetectionIssue>;
