import type { FastifyInstance } from 'fastify';
import type { QuestionResponse } from '../../../../contracts/questions.js';
import { ReassembleRequest, type PageReadingResponse } from '../../../../contracts/review.js';
import type { ApprovedModelsResponse } from '../../../../contracts/sources.js';
import { AppError } from '../../../platform/errors/index.js';
import { createAttemptLimiter } from '../../../platform/http/attempts.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { RequireActor } from '../../identity/index.js';
import { approvedTiers } from '../use-cases/approved-tiers.js';
import type { SourcesDeps } from '../use-cases/deps.js';
import { getPageReading, reassemble, sourcePage } from '../use-cases/page-reading.js';

type IdParams = { Params: { id: string } };
type PageParams = { Params: { id: string; page: string } };

/** Page pictures one owner may have rendered a minute: each runs the PDF renderer. */
const PAGE_RENDERS = { max: 60, windowMs: 60_000 };

/**
 * M34 P6: the review editor (Q26): a question's pages as the import read them, the page picture
 * from the kept original, and re-assembly from corrected roles. Every route is the owner's only;
 * the app's Origin guard covers the POST. Also the tiers the import form may offer (Q14).
 */
export function registerReviewEditorRoutes(
  app: FastifyInstance,
  deps: SourcesDeps,
  requireActor: RequireActor,
) {
  app.get<IdParams>(
    '/api/questions/:id/page-reading',
    async (request): Promise<PageReadingResponse> =>
      getPageReading(deps, await requireActor(request), request.params.id),
  );

  app.post<IdParams>(
    '/api/questions/:id/reassemble',
    async (request): Promise<QuestionResponse> => {
      const actor = await requireActor(request);
      const input = parseInput(ReassembleRequest, request.body);
      return reassemble(deps, actor, request.params.id, input);
    },
  );

  const renders = createAttemptLimiter({ ...PAGE_RENDERS, now: () => deps.clock.now() });
  app.get<PageParams>('/api/sources/:id/pages/:page', async (request, reply) => {
    const actor = await requireActor(request);
    // Every request counts, found or not, before the renderer runs.
    if (renders.blocked(actor.accountId)) throw new AppError('too_many_attempts');
    renders.fail(actor.accountId);
    const png = await sourcePage(deps, actor, request.params.id, Number(request.params.page));
    return reply
      .type('image/png')
      .header('cache-control', 'private, max-age=3600')
      .header('x-content-type-options', 'nosniff')
      .send(png);
  });

  app.get('/api/ai/approved-models', async (request): Promise<ApprovedModelsResponse> => {
    await requireActor(request);
    return approvedTiers(deps);
  });
}
