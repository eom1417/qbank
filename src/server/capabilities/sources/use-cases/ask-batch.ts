import type { AiProvider, StructuredRequest, StructuredResult } from '../../providers/index.js';

/** Failures worth one more try: a reply in the wrong shape, or a dropped connection. */
const PASSING = new Set(['invalid_output', 'unreachable']);

/**
 * One triage request, asked again once when the model replied in the wrong shape or the
 * connection dropped; a refused key or an empty quota is final (it would fail again).
 */
export async function askBatch<T>(provider: AiProvider, request: StructuredRequest<T>) {
  const first = await provider.generate<T>(request);
  if (first.ok || !PASSING.has(first.failure)) return first;
  return provider.generate<T>(request);
}

/**
 * A batch whose reply stays in the wrong shape is asked again in halves, down to one question;
 * a single question whose reply is still unreadable is left as it was (`null` reply) instead of
 * stopping the whole file. Any other failure (a refused key, an empty quota) stops at once.
 */
export async function askInParts<I, T>(
  provider: AiProvider,
  items: readonly I[],
  request: (part: readonly I[]) => StructuredRequest<T>,
): Promise<{ part: readonly I[]; reply: StructuredResult<T> | null }[]> {
  const reply = await askBatch<T>(provider, request(items));
  if (reply.ok || reply.failure !== 'invalid_output') return [{ part: items, reply }];
  if (items.length === 1) return [{ part: items, reply: null }];
  const middle = Math.ceil(items.length / 2);
  const halves = [items.slice(0, middle), items.slice(middle)];
  const parts: { part: readonly I[]; reply: StructuredResult<T> | null }[] = [];
  for (const half of halves) parts.push(...(await askInParts(provider, half, request)));
  return parts;
}
