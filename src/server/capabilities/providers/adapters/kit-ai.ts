import { z } from 'zod';
import type { AiTarget } from '../../../../contracts/providers.js';
import type { AiHostClient } from '../../../platform/ai-host/client.js';
import {
  parseModelOutput,
  type AiFailure,
  type AiProvider,
  type StructuredRequest,
  type StructuredResult,
} from '../domain/ai-provider.js';

/** One question can take a while on a busy subscription; the import waits this long. */
const ASK_TIMEOUT_MS = 180_000;
/** A research turn searches and reads pages first. */
const RESEARCH_TIMEOUT_MS = 420_000;

/** The kit's failure classes as QBank's readiness statuses (what the user sees and retries on). */
const FAILURES: Record<string, Exclude<AiFailure, 'invalid_output'>> = {
  usage_limit: 'no_quota',
  permission_error: 'no_permission',
  provider_error: 'invalid_key',
  transport_error: 'unreachable',
  timeout: 'unreachable',
};

/** A reply may wrap its JSON in prose or a code fence; only the object itself is read. */
function jsonObjectIn(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

function promptOf<T>(request: StructuredRequest<T>): string {
  const text = request.parts.flatMap((part) => (part.type === 'text' ? [part.text] : []));
  const schema = JSON.stringify(z.toJSONSchema(request.schema));
  return [
    request.system,
    ...text,
    `Answer with one JSON object only, no prose and no code fence, matching this JSON Schema:\n${schema}`,
  ].join('\n\n');
}

/** One question to the chosen instance and model, with the page image when there is one. */
function askOf<T>(target: AiTarget, request: StructuredRequest<T>) {
  const image = request.parts.find((part) => part.type === 'image');
  return {
    instanceId: target.instanceId,
    ...(target.model ? { model: target.model } : {}),
    prompt: promptOf(request),
    ...(image?.type === 'image' ? { imagePngBase64: image.base64 } : {}),
    ...(request.research ? { research: true } : {}),
    timeoutMs: request.research ? RESEARCH_TIMEOUT_MS : ASK_TIMEOUT_MS,
  };
}

/**
 * QBank's AI port on a provider instance of the kit (DEC-30): the user's own subscription or
 * key, one read-only turn per question. The reply is still checked by `parseModelOutput`.
 */
export function kitProvider(
  client: AiHostClient,
  ownerSession: string,
  target: AiTarget,
): AiProvider {
  return {
    async generate<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>> {
      const reply = await client.ask(askOf(target, request), ownerSession);
      if (reply.status !== 200) {
        const reason = (reply.body as { error?: { reason?: string } } | null)?.error?.reason ?? '';
        return { ok: false, failure: FAILURES[reason] ?? 'unexpected' };
      }
      const text = String((reply.body as { text?: unknown }).text ?? '');
      const value = parseModelOutput(jsonObjectIn(text), request.schema);
      return value === null
        ? { ok: false, failure: 'invalid_output' }
        : { ok: true, value, usage: null };
    },
  };
}
