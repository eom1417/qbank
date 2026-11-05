import type { AiProvider, StructuredRequest } from '../../providers/index.js';

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
