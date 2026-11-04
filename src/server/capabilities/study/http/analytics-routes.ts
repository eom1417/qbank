import type { FastifyInstance } from 'fastify';
import { SearchQuery } from '../../../../contracts/analytics.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { RequireActor } from '../../identity/index.js';
import {
  importQuality,
  librarySummary,
  sessionHistory,
  suggestion,
  trend,
} from '../use-cases/analytics.js';
import type { StudyDeps } from '../use-cases/deps.js';
import { search } from '../use-cases/search.js';

type Filter = { Querystring: { bankId?: string; mode?: string; weeks?: string } };

const bankOf = (raw: string | undefined) => (raw ? raw : undefined);
const modeOf = (raw: string | undefined) => (raw === 'exam' || raw === 'tutor' ? raw : undefined);
const weeksOf = (raw: string | undefined) => Math.min(Math.max(Number(raw ?? 12) || 12, 1), 104);

/** Analytics (UI-21) and search (UI-22): read only, every figure from one definition (M12). */
export function registerAnalyticsRoutes(
  app: FastifyInstance,
  deps: StudyDeps,
  requireActor: RequireActor,
) {
  app.get<Filter>('/api/analytics/summary', async (request) =>
    librarySummary(deps, await requireActor(request), bankOf(request.query.bankId)),
  );
  app.get<Filter>('/api/analytics/trend', async (request) =>
    trend(deps, await requireActor(request), {
      bankId: bankOf(request.query.bankId),
      weeks: weeksOf(request.query.weeks),
    }),
  );
  app.get<Filter>('/api/analytics/sessions', async (request) =>
    sessionHistory(deps, await requireActor(request), {
      bankId: bankOf(request.query.bankId),
      mode: modeOf(request.query.mode),
    }),
  );
  app.get<{ Params: { bankId: string } }>('/api/analytics/imports/:bankId', async (request) =>
    importQuality(deps, await requireActor(request), request.params.bankId),
  );
  app.get<Filter>('/api/analytics/suggestion', async (request) =>
    suggestion(deps, await requireActor(request), bankOf(request.query.bankId)),
  );
  app.get('/api/search', async (request) =>
    search(deps, await requireActor(request), parseInput(SearchQuery, request.query)),
  );
}
