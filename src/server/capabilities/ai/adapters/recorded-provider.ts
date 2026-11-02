import type { ReadinessStatus } from '../../../../contracts/ai.js';
import { parseModelOutput, type AiProvider } from '../domain/ai-provider.js';

interface Recording {
  readiness: ReadinessStatus;
  /** Raw model outputs, returned in order; each goes through the same validation as live output. */
  outputs: readonly string[];
}

/** Test adapter: deterministic, no network, no model (plan rule 7). */
export function createRecordedProvider(recording: Recording): AiProvider {
  const outputs = [...recording.outputs];
  return {
    checkReadiness: async () => recording.readiness,
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
