/** One bench call per job through either adapter, recorded with tokens, cache split and time. */
import { readFileSync } from 'node:fs';
import type { StructuredRequest } from '../../capabilities/providers/domain/ai-provider.js';
import { AnthropicProvider, type AnthropicCredentials } from './anthropic-provider.js';
import { ClaudeCliProvider } from './claude-cli-provider.js';
import type { Job } from './jobs.js';
import { MARK_SYSTEM, MarkReply, markPrompt, scoreReply } from './reply.js';
import { imageTokens } from './sheet-layout.js';
import type { CallRecord } from './stats.js';

/** System prompt + instruction, roughly, on top of the image (dry runs only). */
const TEXT_OVERHEAD_TOKENS = 200;

export type Via = 'cli' | 'api';

interface Outcome {
  reply: MarkReply | null;
  failure: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheCreation: number;
  cacheRead: number;
}

/** Sends one request through the chosen adapter. */
export type Sender = (request: StructuredRequest<MarkReply>) => Promise<Outcome>;

const EMPTY = { inputTokens: 0, outputTokens: 0, cacheCreation: 0, cacheRead: 0 };

export function makeSender(via: Via, model: string, credentials: AnthropicCredentials): Sender {
  if (via === 'cli') {
    const cli = new ClaudeCliProvider({ model, effort: 'low' });
    return async (request) => {
      const r = await cli.generateDetailed(request);
      return r.ok
        ? { reply: r.value, failure: null, ...r.usage }
        : { reply: null, failure: r.failure, ...EMPTY };
    };
  }
  const api = new AnthropicProvider({ model, credentials, effort: 'low' });
  return async (request) => {
    const r = await api.generate(request);
    if (!r.ok) return { reply: null, failure: r.failure, ...EMPTY };
    return { reply: r.value, failure: null, ...EMPTY, ...(r.usage ?? {}) };
  };
}

function jobRequest(job: Job): StructuredRequest<MarkReply> {
  return {
    name: 'marked_answers',
    system: MARK_SYSTEM,
    parts: [
      {
        type: 'image',
        mediaType: 'image/png',
        base64: readFileSync(job.image.path).toString('base64'),
      },
      {
        type: 'text',
        text: markPrompt(
          job.format,
          job.expected.map((e) => e.item),
        ),
      },
    ],
    schema: MarkReply,
  };
}

export async function callJob(send: Sender, job: Job, model: string): Promise<CallRecord> {
  const started = performance.now();
  const outcome = await send(jobRequest(job));
  return {
    format: job.format,
    size: job.size,
    model,
    questions: job.expected.length,
    correct: scoreReply(outcome.reply, job.expected),
    inputTokens: outcome.inputTokens,
    cacheCreation: outcome.cacheCreation,
    cacheRead: outcome.cacheRead,
    outputTokens: outcome.outputTokens,
    seconds: (performance.now() - started) / 1000,
    failure: outcome.failure,
    estimated: false,
  };
}

/** Fixed input of one turn: same system prompt, no image, a one-line instruction. */
export async function measureOverhead(
  send: Sender,
): Promise<{ inputTokens: number; cacheCreation: number; cacheRead: number }> {
  const outcome = await send({
    name: 'marked_answers',
    system: MARK_SYSTEM,
    parts: [{ type: 'text', text: 'No image this time: reply {"answers":[]}.' }],
    schema: MarkReply,
  });
  return {
    inputTokens: outcome.inputTokens,
    cacheCreation: outcome.cacheCreation,
    cacheRead: outcome.cacheRead,
  };
}

export function estimateJob(job: Job, model: string): CallRecord {
  return {
    format: job.format,
    size: job.size,
    model,
    questions: job.expected.length,
    correct: 0,
    inputTokens: imageTokens(job.image) + TEXT_OVERHEAD_TOKENS,
    cacheCreation: 0,
    cacheRead: 0,
    outputTokens: 0,
    seconds: 0,
    failure: 'not_run',
    estimated: true,
  };
}
