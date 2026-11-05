/**
 * Whether a web tool's target may be searched or opened by a research turn (DEC-34): a search
 * query (plain words), or an http(s) page on a public host. Anything that names this machine or
 * a private network (loopback, private ranges, link-local metadata, single-label or `.local`
 * names), another scheme, or a URL that does not parse, is refused. A public name that resolves
 * to a private address is beyond this check; the provider's own fetch rules apply there.
 */
export function isPublicTarget(target: string): boolean {
  const text = target.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text) || /^(file|data|javascript|mailto):/i.test(text))
    return isPublicUrl(text);
  const address = /^([\w.-]+|\[[\da-f:]+\])(:\d+)?(\/\S*)?$/i.exec(text);
  if (!address) return true; // words: a search query, run by the search engine
  const [, host = '', port, path] = address;
  const looksLikeAddress = port !== undefined || path !== undefined || host.includes('.');
  return !looksLikeAddress || isPublicHost(host.toLowerCase().replace(/^\[|\]$/g, ''));
}

/** An http(s) URL on a public host. */
function isPublicUrl(text: string): boolean {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return isPublicHost(url.hostname.toLowerCase().replace(/^\[|\]$/g, ''));
}

const PRIVATE_V4 = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

function isPublicHost(host: string): boolean {
  if (host.includes(':')) return !/^(::1?|f[cd]|fe[89ab]|::ffff:)/.test(host);
  if (/^\d+(\.\d+){3}$/.test(host)) return !PRIVATE_V4.some((range) => range.test(host));
  if (!host.includes('.')) return false;
  return !/(^|\.)(localhost|local|internal|lan|home\.arpa)$/.test(host);
}

type NativeRef = { nativeId: string } | null | undefined;

/** The parts of the kit's session events (`ProviderAdapterV2Event`) the gate reads. */
type GateEvent =
  | {
      type: 'turn_item.updated';
      turnItem: {
        type: string;
        nodeId: string | null;
        nativeItemRef?: NativeRef;
        patterns?: readonly string[] | undefined;
      };
    }
  | {
      type: 'node.updated';
      node: { id: string; parentNodeId: string | null; nativeItemRef?: NativeRef };
    }
  | { type: string };

type ToolItem = { type: string; patterns?: readonly string[] | undefined };

/** A web tool call, unless it would open something that is not a public web page. */
const isWebItem = (item: ToolItem) =>
  item.type === 'web_search' && (item.patterns ?? []).every(isPublicTarget);

/**
 * Records a tool call as web, or forgets it when an update shows it is not (a page inside the
 * network). Tied by id only (ACP), it must also say what it searches or opens: fail closed.
 */
function learnTool(
  item: ToolItem & { nodeId: string | null; nativeItemRef?: NativeRef },
  webNodes: Set<string>,
  webNatives: Set<string>,
) {
  if (item.type !== 'web_search') return;
  const web = isWebItem(item);
  if (item.nodeId) {
    if (web) webNodes.add(item.nodeId);
    else webNodes.delete(item.nodeId);
  }
  if (!item.nativeItemRef) return;
  if (web && (item.patterns ?? []).length > 0) webNatives.add(item.nativeItemRef.nativeId);
  else webNatives.delete(item.nativeItemRef.nativeId);
}

/**
 * Which tool requests a turn may approve. A research turn (a study note's sources, DEC-34) may
 * search and read the public web, nothing else: a request is approved only when the tool call
 * it belongs to is a web search or fetch (the kit's `web_search` item, for every provider) of
 * public pages. The request is tied to its tool call by its parent node (Claude), or by the
 * provider's own tool call id (ACP providers: Gemini, Kimi, Cursor, Grok…). Every other request
 * (a command, a file read, search or write, a page inside the network) is declined, and a plain
 * turn declines everything. A request seen before its tool call is declined too.
 */
export function toolGate(research: boolean) {
  const webNodes = new Set<string>();
  const webNatives = new Set<string>();
  const parentOf = new Map<string, string>();
  const nativeOf = new Map<string, string>();
  return {
    /** Learns which tool calls are web searches, and which tool call each request belongs to. */
    see(event: GateEvent) {
      if ('turnItem' in event) learnTool(event.turnItem, webNodes, webNatives);
      if (!('node' in event)) return;
      if (event.node.parentNodeId) parentOf.set(event.node.id, event.node.parentNodeId);
      if (event.node.nativeItemRef) nativeOf.set(event.node.id, event.node.nativeItemRef.nativeId);
    },
    /** The decision for one runtime request. */
    decide(requestNodeId: string): 'accept' | 'decline' {
      const parent = parentOf.get(requestNodeId);
      const native = nativeOf.get(requestNodeId);
      const web =
        (parent !== undefined && webNodes.has(parent)) ||
        (native !== undefined && webNatives.has(native));
      return research && web ? 'accept' : 'decline';
    },
  };
}
