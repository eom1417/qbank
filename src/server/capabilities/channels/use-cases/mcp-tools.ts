import { z } from 'zod';
import { BatchRequest, ChannelAnswerRequest } from '../../../../contracts/channels.js';
import { AppError } from '../../../platform/errors/index.js';
import type { ChannelRow } from '../adapters/channel-repository.js';
import { agentStats, batchAnswers, nextBatch, recordAnswer } from './agent.js';
import type { ChannelsDeps } from './deps.js';

/** The channel's tools for an agent that speaks MCP (M23.6): the same four as the REST API. */
export const MCP_TOOLS = [
  {
    name: 'next_batch',
    description:
      'The next questions of this channel to send, without their answers. Pass a key (such as the date) so asking again returns the same batch.',
    inputSchema: z.toJSONSchema(BatchRequest),
  },
  {
    name: 'batch_answers',
    description: 'The answers and explanations of a batch, to send after its questions.',
    inputSchema: z.toJSONSchema(z.object({ batchId: z.uuid() }).strict()),
  },
  {
    name: 'record_answer',
    description:
      "One recipient's answer to a question the channel sent; says if it is right. `recipient` is your own name for them, never stored as is.",
    inputSchema: z.toJSONSchema(ChannelAnswerRequest),
  },
  {
    name: 'channel_stats',
    description: "This channel's own numbers: what it sent and how its recipients answered.",
    inputSchema: z.toJSONSchema(z.object({}).strict()),
  },
];

const parsed = <S extends z.ZodType>(schema: S, input: unknown): z.infer<S> => {
  const result = schema.safeParse(input ?? {});
  if (!result.success) throw new AppError('validation_failed');
  return result.data;
};

/** Runs one tool on the channel the key opened; an unknown tool is not found. */
export function callTool(deps: ChannelsDeps, row: ChannelRow, name: string, input: unknown) {
  switch (name) {
    case 'next_batch':
      return nextBatch(deps, row, parsed(BatchRequest, input).key);
    case 'batch_answers':
      return batchAnswers(deps, row, parsed(z.object({ batchId: z.uuid() }), input).batchId);
    case 'record_answer':
      return recordAnswer(deps, row, parsed(ChannelAnswerRequest, input));
    case 'channel_stats':
      return agentStats(deps, row);
    default:
      throw new AppError('not_found');
  }
}
