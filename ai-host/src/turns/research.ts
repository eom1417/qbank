/** The parts of the kit's session events (`ProviderAdapterV2Event`) the gate reads. */
type GateEvent =
  | { type: 'turn_item.updated'; turnItem: { type: string; nodeId: string | null } }
  | { type: 'node.updated'; node: { id: string; parentNodeId: string | null } }
  | { type: string };

/**
 * Which tool requests a turn may approve. A research turn (a study note's sources, DEC-33) may
 * search and read the web, nothing else: a request is approved only when the tool call it
 * belongs to is a web search or fetch (the kit's `web_search` item). Every other request (a
 * command, a file read or write) is declined, and a plain turn declines everything.
 */
export function toolGate(research: boolean) {
  const webTools = new Set<string>();
  const parentOf = new Map<string, string>();
  return {
    /** Learns which tool calls are web searches, and which tool call each request belongs to. */
    see(event: GateEvent) {
      if ('turnItem' in event && event.turnItem.type === 'web_search' && event.turnItem.nodeId)
        webTools.add(event.turnItem.nodeId);
      if ('node' in event && event.node.parentNodeId)
        parentOf.set(event.node.id, event.node.parentNodeId);
    },
    /** The decision for one runtime request. */
    decide(requestNodeId: string): 'accept' | 'decline' {
      const tool = parentOf.get(requestNodeId);
      return research && tool !== undefined && webTools.has(tool) ? 'accept' : 'decline';
    },
  };
}
