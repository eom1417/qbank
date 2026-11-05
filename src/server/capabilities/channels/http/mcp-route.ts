import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AppError } from '../../../platform/errors/index.js';
import type { ChannelRow } from '../adapters/channel-repository.js';
import type { ChannelsDeps } from '../use-cases/deps.js';
import { callTool, MCP_TOOLS } from '../use-cases/mcp-tools.js';

const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

interface RpcRequest {
  jsonrpc?: unknown;
  id?: string | number | null;
  method?: unknown;
  params?: { protocolVersion?: unknown; name?: unknown; arguments?: unknown };
}

const result = (id: RpcRequest['id'], value: unknown) => ({ jsonrpc: '2.0', id, result: value });
const failure = (id: RpcRequest['id'], code: number, message: string) => ({
  jsonrpc: '2.0',
  id: id ?? null,
  error: { code, message },
});

function initialize(request: RpcRequest) {
  const asked = request.params?.protocolVersion;
  return result(request.id, {
    protocolVersion: typeof asked === 'string' && VERSIONS.includes(asked) ? asked : VERSIONS[0],
    capabilities: { tools: {} },
    serverInfo: { name: 'qbank-channel', version: '1' },
  });
}

/** A tool's result as MCP content; an application error is the tool's error, said plainly. */
async function toolCall(deps: ChannelsDeps, row: ChannelRow, request: RpcRequest) {
  const name = typeof request.params?.name === 'string' ? request.params.name : '';
  try {
    const value = await callTool(deps, row, name, request.params?.arguments);
    return result(request.id, { content: [{ type: 'text', text: JSON.stringify(value) }] });
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    return result(request.id, { content: [{ type: 'text', text: error.code }], isError: true });
  }
}

async function answer(deps: ChannelsDeps, row: ChannelRow, request: RpcRequest) {
  if (request.jsonrpc !== '2.0' || typeof request.method !== 'string')
    return failure(request.id, -32600, 'Invalid request');
  if (request.method === 'initialize') return initialize(request);
  if (request.method === 'ping') return result(request.id, {});
  if (request.method === 'tools/list') return result(request.id, { tools: MCP_TOOLS });
  if (request.method === 'tools/call') return toolCall(deps, row, request);
  return failure(request.id, -32601, 'Method not found');
}

/**
 * `POST /api/channel/v1/mcp`: the channel as an MCP server (Streamable HTTP, JSON replies), for
 * agents that speak MCP. The same key and the same rules as the REST API (DEC-36).
 */
export function registerMcpRoute(
  app: FastifyInstance,
  deps: ChannelsDeps,
  channelOf: (request: FastifyRequest) => Promise<ChannelRow>,
) {
  app.post('/api/channel/v1/mcp', async (request, reply) => {
    const row = await channelOf(request);
    const body = request.body as RpcRequest | null;
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return reply.status(400).send(failure(null, -32700, 'Parse error'));
    // A notification (no id) is accepted with nothing to say.
    if (body.id === undefined) return reply.status(202).send();
    return answer(deps, row, body);
  });
  app.get('/api/channel/v1/mcp', async (_request, reply) => reply.status(405).send());
}
