import type { FastifyInstance } from 'fastify';
import type { ShareSecretResponse, ShareView } from '../../../../contracts/sharing.js';
import type { RequireActor } from '../../identity/index.js';
import type { ChannelsDeps } from '../use-cases/deps.js';
import { removeShare } from '../use-cases/manage.js';
import { controlShare, renewSecret, type Control } from '../use-cases/shares-control.js';

type IdParams = { Params: { id: string } };

const CONTROLS: readonly Control[] = ['pause', 'resume', 'end', 'archive'];

/** The owner's controls over a share (signed in, DEC-39): pause, end, archive, renew, delete. */
export function registerOwnerRoutes(
  app: FastifyInstance,
  deps: ChannelsDeps,
  requireActor: RequireActor,
) {
  for (const control of CONTROLS)
    app.post<IdParams>(`/api/shares/:id/${control}`, async (request): Promise<ShareView> =>
      controlShare(deps, await requireActor(request), request.params.id, control),
    );

  app.post<IdParams>('/api/shares/:id/secret', async (request): Promise<ShareSecretResponse> =>
    renewSecret(deps, await requireActor(request), request.params.id),
  );

  app.delete<IdParams>('/api/shares/:id', async (request, reply) => {
    await removeShare(deps, await requireActor(request), request.params.id);
    return reply.status(204).send();
  });
}
