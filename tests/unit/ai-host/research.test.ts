import { describe, expect, it } from 'vitest';
import { toolGate } from '../../../ai-host/src/turns/research.js';

type Event = Parameters<ReturnType<typeof toolGate>['see']>[0];
const node = (id: string, parentNodeId: string) =>
  ({ type: 'node.updated', node: { id, parentNodeId } }) as unknown as Event;
const item = (type: string, nodeId: string) =>
  ({ type: 'turn_item.updated', turnItem: { type, nodeId } }) as unknown as Event;

/** A web search tool call `web` and a Bash call `bash`, each asking for approval. */
function seen(research: boolean) {
  const gate = toolGate(research);
  for (const event of [
    item('web_search', 'web'),
    node('ask-web', 'web'),
    item('command_execution', 'bash'),
    node('ask-bash', 'bash'),
  ])
    gate.see(event);
  return gate;
}

describe('the tool gate of a turn', () => {
  it('lets a research turn search the web, and nothing else', () => {
    const gate = seen(true);
    expect(gate.decide('ask-web')).toBe('accept');
    expect(gate.decide('ask-bash')).toBe('decline');
    expect(gate.decide('ask-unknown')).toBe('decline');
  });

  it('declines everything on a plain turn, web search included', () => {
    expect(seen(false).decide('ask-web')).toBe('decline');
  });
});
