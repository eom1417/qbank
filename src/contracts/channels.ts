import { z } from 'zod';

/**
 * Publishing channels (M23, DEC-36): an outside agent (WhatsApp, Telegram, n8n…) takes batches of
 * a bank's ready questions with the channel's own key. Everything a channel records stays apart
 * from the owner's study: its numbers are the channel's alone.
 */

const Letter = z.string().regex(/^[A-J]$/);

/** How a channel is set up by its owner. */
export const ChannelSettings = z
  .object({
    name: z.string().trim().min(1).max(100),
    /** Empty: every chapter of the bank. */
    chapterIds: z.array(z.uuid()).max(200),
    batchSize: z.number().int().min(1).max(10),
    /** When every question has gone out: start a new cycle, or stop sending. */
    whenDone: z.enum(['restart', 'stop']),
  })
  .strict();
export type ChannelSettings = z.infer<typeof ChannelSettings>;

export const ChannelUpdate = ChannelSettings.partial()
  .extend({ paused: z.boolean().optional() })
  .strict();

export const ChannelView = ChannelSettings.extend({
  id: z.uuid(),
  bankId: z.uuid(),
  /** The key's first characters, to recognise it; the key itself is shown once. */
  keyPrefix: z.string(),
  paused: z.boolean(),
  cycle: z.number().int(),
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime().nullable(),
}).strict();
export type ChannelView = z.infer<typeof ChannelView>;

export const ChannelListResponse = z.object({ channels: z.array(ChannelView) }).strict();
export type ChannelListResponse = z.infer<typeof ChannelListResponse>;

/** A new channel or a new key: the key is in this answer only, never again. */
export const ChannelKeyResponse = z.object({ channel: ChannelView, key: z.string() }).strict();
export type ChannelKeyResponse = z.infer<typeof ChannelKeyResponse>;

/** A channel's own numbers: what it sent and how its recipients answered. */
export const ChannelStats = z
  .object({
    cycle: z.number().int(),
    ready: z.number().int(),
    sentThisCycle: z.number().int(),
    sentTotal: z.number().int(),
    batches: z.number().int(),
    answers: z.number().int(),
    correct: z.number().int(),
    questions: z.array(
      z
        .object({
          questionId: z.uuid(),
          stem: z.string(),
          sent: z.number().int(),
          answers: z.number().int(),
          correct: z.number().int(),
        })
        .strict(),
    ),
    recent: z.array(
      z.object({ batchId: z.uuid(), at: z.iso.datetime(), questions: z.number().int() }).strict(),
    ),
  })
  .strict();
export type ChannelStats = z.infer<typeof ChannelStats>;

/** `POST /api/channel/v1/batches`: the agent's name for the batch makes asking again safe. */
export const BatchRequest = z
  .object({ key: z.string().trim().min(1).max(100).optional() })
  .strict();

/** One question as it goes out: no answer, and its pictures through the channel's own route. */
const BatchQuestion = z
  .object({
    deliveryId: z.uuid(),
    questionId: z.uuid(),
    stem: z.string(),
    options: z.array(z.object({ letter: Letter, text: z.string() }).strict()),
    multiSelect: z.boolean(),
    pictures: z.array(z.string()),
  })
  .strict();

export const BatchResponse = z
  .object({
    id: z.uuid(),
    cycle: z.number().int(),
    createdAt: z.iso.datetime(),
    questions: z.array(BatchQuestion),
    /** Nothing left to send: the channel stops when it has gone through every question. */
    done: z.boolean(),
  })
  .strict();
export type BatchResponse = z.infer<typeof BatchResponse>;

/** `GET /api/channel/v1/batches/:id/answers`: what to send after the questions. */
export const BatchAnswersResponse = z
  .object({
    id: z.uuid(),
    answers: z.array(
      z
        .object({
          deliveryId: z.uuid(),
          questionId: z.uuid(),
          answers: z.array(Letter),
          explanation: z.string().nullable(),
          /** From the AI's study note, when the question has one (DEC-34). */
          topic: z.string().nullable(),
          keyIdea: z.string().nullable(),
        })
        .strict(),
    ),
  })
  .strict();
export type BatchAnswersResponse = z.infer<typeof BatchAnswersResponse>;

/** `POST /api/channel/v1/answers`: one recipient's answer, by the agent's own name for them. */
export const ChannelAnswerRequest = z
  .object({
    deliveryId: z.uuid(),
    recipient: z.string().trim().min(1).max(200),
    choice: z.array(Letter).min(1).max(10),
  })
  .strict();

export const ChannelAnswerResponse = z
  .object({ correct: z.boolean(), answers: z.array(Letter) })
  .strict();
export type ChannelAnswerResponse = z.infer<typeof ChannelAnswerResponse>;
