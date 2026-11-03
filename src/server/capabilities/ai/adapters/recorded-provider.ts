import type { ReadinessStatus } from '../../../../contracts/ai.js';
import { parseModelOutput, type AiProvider } from '../domain/ai-provider.js';

interface Recording {
  readiness: ReadinessStatus;
  /** Models the key may use; the default is whatever a request asks for. */
  models?: string[];
  /** Raw model outputs, returned in order; each goes through the same validation as live output. */
  outputs: readonly string[];
}

/** Test adapter: deterministic, no network, no model (plan rule 7). */
export function createRecordedProvider(recording: Recording): AiProvider {
  const outputs = [...recording.outputs];
  return {
    listModels: async () => ({
      status: recording.readiness === 'unchecked' ? 'ready' : recording.readiness,
      models: recording.readiness === 'ready' ? (recording.models ?? []) : [],
    }),
    async generate(request) {
      if (recording.readiness !== 'ready' && recording.readiness !== 'unchecked') {
        return { ok: false, failure: recording.readiness };
      }
      const raw = outputs.shift();
      const value = raw === undefined ? null : parseModelOutput(raw, request.schema);
      return value === null
        ? { ok: false, failure: 'invalid_output' }
        : { ok: true, value, usage: null };
    },
  };
}
