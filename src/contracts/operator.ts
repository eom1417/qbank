import { z } from 'zod';

/**
 * The server operator's console (M31, DEC-40). The operator is declared by QBANK_OPERATOR_EMAIL
 * and sees feedback, password-reset requests and the import queue: never a bank or a question.
 */

/** A user's note to the operator; it carries no question text unless the user types it. */
export const FeedbackRequest = z
  .object({
    message: z.string().trim().min(1).max(2000),
    /** Where the user was (a route path such as `/banks`), to help the operator reproduce it. */
    screen: z.string().trim().max(200).default(''),
  })
  .strict();
export type FeedbackRequest = z.infer<typeof FeedbackRequest>;

export const FeedbackItem = z
  .object({
    id: z.uuid(),
    accountEmail: z.string(),
    accountName: z.string(),
    message: z.string(),
    screen: z.string(),
    version: z.string(),
    createdAt: z.iso.datetime(),
    closedAt: z.iso.datetime().nullable(),
  })
  .strict();
export type FeedbackItem = z.infer<typeof FeedbackItem>;

export const FeedbackListResponse = z.object({ items: z.array(FeedbackItem) }).strict();
export type FeedbackListResponse = z.infer<typeof FeedbackListResponse>;

/** One account's latest "forgot password" request, waiting for the operator to pass it on. */
export const ResetRequestItem = z
  .object({
    accountId: z.uuid(),
    email: z.string(),
    displayName: z.string(),
    requestedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    expired: z.boolean(),
  })
  .strict();
export type ResetRequestItem = z.infer<typeof ResetRequestItem>;

export const ResetRequestListResponse = z.object({ items: z.array(ResetRequestItem) }).strict();
export type ResetRequestListResponse = z.infer<typeof ResetRequestListResponse>;

/** The link to send by hand. `fresh` true: a new link was made because the last one expired. */
export const ResetLinkResponse = z
  .object({ link: z.url(), expiresAt: z.iso.datetime(), fresh: z.boolean() })
  .strict();
export type ResetLinkResponse = z.infer<typeof ResetLinkResponse>;

/** An import in the server-wide queue: who and how big, never the file's content. */
export const QueueItem = z
  .object({
    jobId: z.uuid(),
    accountEmail: z.string(),
    pagesTotal: z.number().int(),
    pagesDone: z.number().int(),
    state: z.enum(['running', 'waiting']),
    since: z.iso.datetime(),
  })
  .strict();
export type QueueItem = z.infer<typeof QueueItem>;

export const QueueResponse = z
  .object({ workers: z.number().int().min(1), items: z.array(QueueItem) })
  .strict();
export type QueueResponse = z.infer<typeof QueueResponse>;
