import { describe, expect, it } from 'vitest';
import { newChannel } from '../support/channels.js';
import { ownerWithBank } from '../support/client.js';
import { useReviewSuite } from '../support/questions.js';

const { app, seed } = useReviewSuite();

const rpc = (key: string, payload: object) =>
  app().inject({
    method: 'POST',
    url: '/api/channel/v1/mcp',
    headers: { authorization: `Bearer ${key}` },
    payload,
  });

const call = (key: string, name: string, args: object = {}) =>
  rpc(key, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name, arguments: args } });

describe('the channel as an MCP server (M23.6)', () => {
  it('introduces itself, lists its four tools, and runs them with the same rules', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    await seed(owner, bankId, [{ stem: 'Only?', answers: ['B'] }]);
    const { key } = await newChannel(owner, bankId);
    const hello = (
      await rpc(key, {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-03-26' },
      })
    ).json();
    expect(hello.result).toMatchObject({
      protocolVersion: '2025-03-26',
      capabilities: { tools: {} },
    });
    expect(
      (await rpc(key, { jsonrpc: '2.0', method: 'notifications/initialized' })).statusCode,
    ).toBe(202);
    const tools = (await rpc(key, { jsonrpc: '2.0', id: 2, method: 'tools/list' })).json().result
      .tools;
    expect(tools.map((tool: { name: string }) => tool.name)).toEqual([
      'next_batch',
      'batch_answers',
      'record_answer',
      'channel_stats',
    ]);
    const batch = JSON.parse(
      (await call(key, 'next_batch', { key: 'day-1' })).json().result.content[0].text,
    );
    expect(batch.questions).toHaveLength(1);
    expect(JSON.stringify(batch)).not.toContain('"answers"');
    const revealed = JSON.parse(
      (await call(key, 'batch_answers', { batchId: batch.id })).json().result.content[0].text,
    );
    expect(revealed.answers[0].answers).toEqual(['B']);
  });

  it('says a refused call plainly, and opens nothing without the key', async () => {
    const { owner, bankId } = await ownerWithBank(app());
    const { key } = await newChannel(owner, bankId);
    const bad = (await call(key, 'batch_answers', { batchId: 'nope' })).json().result;
    expect(bad).toMatchObject({ isError: true, content: [{ text: 'validation_failed' }] });
    expect((await call(key, 'drop_everything')).json().result.isError).toBe(true);
    const unknown = (await rpc(key, { jsonrpc: '2.0', id: 9, method: 'resources/list' })).json();
    expect(unknown.error.code).toBe(-32601);
    expect((await call('qbc_not-a-key', 'channel_stats')).statusCode).toBe(401);
  });
});
