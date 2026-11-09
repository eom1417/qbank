import type { LightMyRequestResponse } from 'fastify';
import { describe, expect, it } from 'vitest';
import { agentOf, newShare, type PolicyChanges } from '../support/channels.js';
import { ownerWithBank } from '../support/client.js';
import { useReviewSuite } from '../support/questions.js';

const { app, seed } = useReviewSuite();

const HOUR = 3_600_000;
const hoursFromNow = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString();

/** What a call came to: `ok` with its value, or the error code it was refused with. */
type Outcome = { code: string; value?: Record<string, unknown> };

const fromHttp = (response: LightMyRequestResponse): Outcome =>
  response.statusCode < 300
    ? { code: 'ok', value: response.json() }
    : { code: response.json().error?.code ?? String(response.statusCode) };

/** One way an agent reaches its share: the REST API or the MCP tools (DEC-36, M23.6). */
interface Transport {
  name: string;
  open(key: string): Promise<Outcome>;
  reveal(key: string, batchId: string): Promise<Outcome>;
  record(key: string, deliveryId: string): Promise<Outcome>;
}

const rest: Transport = {
  name: 'REST',
  open: async (key) => fromHttp(await agentOf(app(), key).batch()),
  reveal: async (key, batchId) => fromHttp(await agentOf(app(), key).answers(batchId)),
  record: async (key, deliveryId) =>
    fromHttp(await agentOf(app(), key).answer({ deliveryId, recipient: 'r1', choice: ['B'] })),
};

async function tool(key: string, name: string, args: object): Promise<Outcome> {
  const response = await app().inject({
    method: 'POST',
    url: '/api/channel/v1/mcp',
    headers: { authorization: `Bearer ${key}` },
    payload: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } },
  });
  if (response.statusCode !== 200) return fromHttp(response);
  const result = response.json().result;
  const text = result.content[0].text as string;
  return result.isError ? { code: text } : { code: 'ok', value: JSON.parse(text) };
}

const mcp: Transport = {
  name: 'MCP',
  open: (key) => tool(key, 'next_batch', {}),
  reveal: (key, batchId) => tool(key, 'batch_answers', { batchId }),
  record: (key, deliveryId) =>
    tool(key, 'record_answer', { deliveryId, recipient: 'r1', choice: ['B'] }),
};

/** An owner, a bank with three ready questions, and an agent share with this policy. */
async function agentShare(changes: PolicyChanges = {}) {
  const { owner, bankId } = await ownerWithBank(app());
  await seed(owner, bankId, [{ answers: ['B'] }, { answers: ['B'] }, { answers: ['B'] }]);
  const share = await newShare(owner, bankId, 'agent', changes);
  expect(share.response.statusCode).toBe(201);
  return { owner, bankId, ...share };
}

type Share = Awaited<ReturnType<typeof agentShare>>;

interface Case {
  name: string;
  changes?: PolicyChanges;
  /** What the owner (or a first call) does before the agent asks for a new batch. */
  before?(share: Share, transport: Transport): Promise<unknown>;
  /** The key the agent then presents (the share's own by default). */
  keyOf?(share: Share, renewed: string | undefined): string;
  expected: string;
}

/** Each refusal of the gate (DEC-39), and the default policy that refuses nothing. */
const CASES: Case[] = [
  { name: 'an active share with the default policy', expected: 'ok' },
  {
    name: 'a paused share',
    before: (s) => s.owner.post(`/api/shares/${s.id}/pause`),
    expected: 'channel_paused',
  },
  {
    name: 'a share its owner ended',
    before: (s) => s.owner.post(`/api/shares/${s.id}/end`),
    expected: 'share_ended',
  },
  {
    name: 'a share past its end',
    changes: { limits: { endsAt: hoursFromNow(-1) } },
    expected: 'share_ended',
  },
  {
    name: 'a share not started yet',
    changes: { limits: { startsAt: hoursFromNow(24) } },
    expected: 'share_not_started',
  },
  {
    name: 'an archived share',
    before: (s) => s.owner.post(`/api/shares/${s.id}/archive`),
    expected: 'not_found',
  },
  {
    name: 'a renewed secret (the old one)',
    before: (s) => s.owner.post(`/api/shares/${s.id}/secret`),
    expected: 'unauthenticated',
  },
  {
    name: 'a share over its daily limit',
    changes: { limits: { batchesPerDay: 1 } },
    before: (s, transport) => transport.open(s.key),
    expected: 'share_limit_reached',
  },
];

describe.each([rest, mcp])('one gate for every agent transport: $name (DEC-39)', (transport) => {
  it.each(CASES)('$name → $expected', async (rule) => {
    const share = await agentShare(rule.changes);
    if (rule.before) await rule.before(share, transport);
    const outcome = await transport.open(share.key);
    expect(outcome.code).toBe(rule.expected);
  });

  it('still lets the renewed key in at once', async () => {
    const share = await agentShare();
    const renewed = (await share.owner.post(`/api/shares/${share.id}/secret`)).json();
    expect(renewed.secret).toMatch(/^qbc_/);
    expect((await transport.open(renewed.secret)).code).toBe('ok');
  });

  it('keeps the answers until the reveal is due, but still records an answer', async () => {
    const share = await agentShare({ reveal: { when: 'after_hours', hours: 1 } });
    const batch = await transport.open(share.key);
    const questions = batch.value?.['questions'] as { deliveryId: string }[];
    const revealed = await transport.reveal(share.key, batch.value?.['id'] as string);
    expect(revealed.code).toBe('not_revealed_yet');
    const recorded = await transport.record(share.key, questions[0]?.deliveryId as string);
    expect(recorded).toEqual({ code: 'ok', value: { correct: true, answers: [] } });
    const stats = (await agentOf(app(), share.key).stats()).json();
    expect(stats).toMatchObject({ answers: 1, correct: 1 });
  });

  it('answers a paused share for what it already sent, and records nothing new', async () => {
    const share = await agentShare();
    const batch = await transport.open(share.key);
    await share.owner.post(`/api/shares/${share.id}/pause`);
    const revealed = await transport.reveal(share.key, batch.value?.['id'] as string);
    expect(revealed.code).toBe('ok');
    const questions = batch.value?.['questions'] as { deliveryId: string }[];
    expect((await transport.record(share.key, questions[0]?.deliveryId as string)).code).toBe(
      'channel_paused',
    );
  });
});

describe('the same batch again', () => {
  it('reads a batch already sent by its key even when the share is paused or at its limit', async () => {
    const share = await agentShare({ limits: { batchesPerDay: 1 } });
    const agent = agentOf(app(), share.key);
    const first = (await agent.batch({ key: 'day-1' })).json();
    expect((await agent.batch({ key: 'day-2' })).json().error.code).toBe('share_limit_reached');
    await share.owner.post(`/api/shares/${share.id}/pause`);
    expect((await agent.batch({ key: 'day-1' })).json().id).toBe(first.id);
    expect((await agent.batch({ key: 'day-3' })).json().error.code).toBe('channel_paused');
  });

  it('records each new batch that sent questions in the share record', async () => {
    const share = await agentShare({ content: { size: 2 } });
    await agentOf(app(), share.key).batch();
    const { events } = (await share.owner.get(`/api/shares/${share.id}/events`)).json();
    expect(events.map((e: { type: string }) => e.type)).toEqual(['batch_sent', 'created']);
    expect(events[0]).toMatchObject({ version: 1, detail: { questions: 2 } });
  });
});
