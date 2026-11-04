import type { FastifyInstance } from 'fastify';
import { SearchQuery } from '../../../../contracts/analytics.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { Actor, RequireActor } from '../../identity/index.js';
import {
  banksOf,
  importQuality,
  librarySummary,
  sessionHistory,
  suggestion,
  trend,
} from '../use-cases/analytics.js';
import type { StudyDeps } from '../use-cases/deps.js';
import { search } from '../use-cases/search.js';
import { resultsReport } from '../use-cases/report.js';
import { AppError } from '../../../platform/errors/index.js';

type Filter = { Querystring: { bankId?: string; mode?: string; weeks?: string } };

const bankOf = (raw: string | undefined) => (raw ? raw : undefined);
const modeOf = (raw: string | undefined) => (raw === 'exam' || raw === 'tutor' ? raw : undefined);
const weeksOf = (raw: string | undefined) => Math.min(Math.max(Number(raw ?? 12) || 12, 1), 104);

interface ReportQuery {
  bankId?: string;
  from?: string;
  to?: string;
  locale?: string;
}

const DAY_MS = 24 * 3600 * 1000;

/** The results report for a period, the last 30 days unless given (FR-18-002, DEC-19 assumed). */
async function reportOf(deps: StudyDeps, actor: Actor, q: ReportQuery) {
  const to = q.to ? new Date(`${q.to}T23:59:59.999Z`) : new Date();
  const from = q.from ? new Date(`${q.from}T00:00:00.000Z`) : new Date(to.getTime() - 30 * DAY_MS);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()))
    throw new AppError('validation_failed', { from: 'invalid_value' });
  const bankId = q.bankId ? (await banksOf(deps, actor, q.bankId))[0] : undefined;
  return resultsReport(deps, actor.accountId, {
    bankId,
    from,
    to,
    locale: q.locale === 'en' ? 'en' : 'ar',
  });
}

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
  app.get<{ Querystring: ReportQuery }>('/api/analytics/report', async (request, reply) => {
    const actor = await requireActor(request);
    const html = await reportOf(deps, actor, request.query);
    return reply
      .header('content-type', 'text/html; charset=utf-8')
      .header('content-disposition', 'attachment; filename="qbank-report.html"')
      .send(html);
  });
  app.get('/api/search', async (request) =>
    search(deps, await requireActor(request), parseInput(SearchQuery, request.query)),
  );
}
