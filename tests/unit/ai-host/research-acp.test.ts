import { describe, expect, it } from 'vitest';
import { toolGate } from '../../../ai-host/src/turns/research.js';

type Event = Parameters<ReturnType<typeof toolGate>['see']>[0];
const ref = (nativeId: string) => ({ driver: 'gemini', nativeId, strength: 'weak' });
/** An ACP approval node: under the turn's root, linked to its tool only by the native id. */
const ask = (id: string, toolCallId: string) =>
  ({
    type: 'node.updated',
    node: { id, parentNodeId: 'root', nativeItemRef: ref(toolCallId) },
  }) as unknown as Event;
const tool = (type: string, toolCallId: string, patterns?: string[]) =>
  ({
    type: 'turn_item.updated',
    turnItem: { type, nodeId: `node-${toolCallId}`, nativeItemRef: ref(toolCallId), patterns },
  }) as unknown as Event;

function gateAfter(...events: Event[]) {
  const gate = toolGate(true);
  for (const event of events) gate.see(event);
  return gate;
}

describe('the tool gate with ACP providers (Gemini, Kimi, Cursor, Grok…)', () => {
  it('approves a web search or a public page, linked by the tool call id', () => {
    const gate = gateAfter(
      tool('web_search', 'search-1', ['amblyopia treatment guideline']),
      ask('ask-1', 'search-1'),
      tool('web_search', 'fetch-1', ['https://www.aao.org/eye-health']),
      ask('ask-2', 'fetch-1'),
      tool('approval_request', 'fetch-1'),
    );
    expect([gate.decide('ask-1'), gate.decide('ask-2')]).toEqual(['accept', 'accept']);
  });

  it('declines a file search, a command, and a request seen before its tool', () => {
    const gate = gateAfter(
      tool('file_search', 'grep-1', ['password']),
      ask('ask-1', 'grep-1'),
      tool('command_execution', 'bash-1'),
      ask('ask-2', 'bash-1'),
      ask('ask-3', 'later-1'),
    );
    const early = gate.decide('ask-3');
    gate.see(tool('web_search', 'later-1', ['query']));
    expect([gate.decide('ask-1'), gate.decide('ask-2'), early]).toEqual([
      'decline',
      'decline',
      'decline',
    ]);
  });
});

describe('the tool gate with ACP providers: what may be opened', () => {
  it('withdraws a web call whose target turns out to be inside, or is not said at all', () => {
    const gate = gateAfter(
      tool('web_search', 'f-1', ['https://example.org/']),
      tool('web_search', 'f-1', ['http://127.0.0.1:3000/']),
      ask('ask-1', 'f-1'),
      tool('web_search', 'f-2'),
      ask('ask-2', 'f-2'),
    );
    expect([gate.decide('ask-1'), gate.decide('ask-2')]).toEqual(['decline', 'decline']);
  });

  it('declines opening anything that is not a public web page', () => {
    const inside = [
      'http://127.0.0.1:3790/state',
      'http://localhost:3000/api',
      'localhost:3000/api',
      'http://10.0.0.5/',
      'http://192.168.1.1/',
      'http://172.20.0.1/',
      'http://169.254.169.254/latest/meta-data',
      'http://[::1]/',
      'http://postgres/',
      'http://printer.local/',
      'file:///etc/passwd',
      'ftp://example.com/x',
      '10.0.0.5/admin',
    ];
    const gate = gateAfter(
      ...inside.flatMap((url, i) => [tool('web_search', `f${i}`, [url]), ask(`a${i}`, `f${i}`)]),
    );
    expect(inside.map((_, i) => gate.decide(`a${i}`))).toEqual(inside.map(() => 'decline'));
  });

  it('approves plain search queries, one word or with punctuation', () => {
    const queries = ['amblyopia', 'DIC: causes', 'aao.org amblyopia 2025', 'https://aao.org/x'];
    const gate = gateAfter(
      ...queries.flatMap((q, i) => [tool('web_search', `q${i}`, [q]), ask(`a${i}`, `q${i}`)]),
    );
    expect(queries.map((_, i) => gate.decide(`a${i}`))).toEqual(queries.map(() => 'accept'));
  });
});
