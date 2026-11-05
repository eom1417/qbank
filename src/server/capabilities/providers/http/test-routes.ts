import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AiTarget, type ModelTestResponse } from '../../../../contracts/providers.js';
import { AppError } from '../../../platform/errors/index.js';
import type { AiHostClient } from '../../../platform/ai-host/client.js';
import type { RequireActor } from '../../identity/index.js';
import { kitProvider } from '../adapters/kit-ai.js';
import { ownerOf } from './routes.js';

const Pong = z.object({ ok: z.literal(true) }).strict();

/**
 * `POST /api/providers/test`: one tiny real turn on the chosen model (local mode only: it runs
 * on the install's subscription). The model list says what the kit offers; this says it runs.
 */
export function registerModelTestRoute(
  app: FastifyInstance,
  client: AiHostClient,
  requireActor: RequireActor,
) {
  app.post('/api/providers/test', async (request): Promise<ModelTestResponse> => {
    const owner = await ownerOf(requireActor, request);
    const target = AiTarget.safeParse(request.body);
    if (!target.success) throw new AppError('validation_failed', { instanceId: 'invalid_value' });
    const result = await kitProvider(client, owner, target.data).generate({
      name: 'model_test',
      system: 'This is a connection test.',
      parts: [{ type: 'text', text: 'Reply with {"ok": true}.' }],
      schema: Pong,
    });
    return { status: result.ok ? 'ready' : result.failure };
  });
}
