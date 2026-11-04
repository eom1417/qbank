import type { FastifyInstance } from 'fastify';
import {
  AiExplanationRequest,
  AnswerRequest,
  ChoiceRequest,
  FlagRequest,
  SubmitRequest,
  PositionRequest,
  PreviewRequest,
  StartSessionRequest,
} from '../../../../contracts/study.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { RequireActor } from '../../identity/index.js';
import { explainWithAi } from '../use-cases/ai-explanation.js';
import { dueToday, questionMastery, topicPriorities } from '../use-cases/plan.js';
import {
  answerImpact,
  examState,
  flagExamItem,
  openExamItem,
  saveChoice,
  submitExam,
} from '../use-cases/exam.js';
import type { StudyDeps } from '../use-cases/deps.js';
import { answerItem, getItem, retryWrong, summary } from '../use-cases/items.js';
import {
  activeSessions,
  finishSession,
  getSession,
  preview,
  setPosition,
  startSession,
} from '../use-cases/sessions.js';

type SessionParams = { Params: { id: string } };
type ItemParams = { Params: { id: string; position: string } };

const positionOf = (raw: string) => {
  const position = Number(raw);
  return Number.isInteger(position) && position >= 0 ? position : -1;
};

/** Session setup and lifecycle (M9.1–M9.3, M9.7, M9.8). */
function registerSessionRoutes(app: FastifyInstance, deps: StudyDeps, requireActor: RequireActor) {
  app.post('/api/study/preview', async (request) => {
    const { scope, kind } = parseInput(PreviewRequest, request.body);
    return preview(deps, await requireActor(request), scope, kind);
  });
  app.post('/api/study/sessions', async (request, reply) => {
    const actor = await requireActor(request);
    const session = await startSession(deps, actor, parseInput(StartSessionRequest, request.body));
    return reply.status(201).send(session);
  });
  app.get('/api/study/sessions', async (request) =>
    activeSessions(deps, await requireActor(request)),
  );
  app.get<SessionParams>('/api/study/sessions/:id', async (request) =>
    getSession(deps, await requireActor(request), request.params.id),
  );
  app.post<SessionParams>('/api/study/sessions/:id/position', async (request) => {
    const { position } = parseInput(PositionRequest, request.body);
    return setPosition(deps, await requireActor(request), request.params.id, position);
  });
  app.post<SessionParams>('/api/study/sessions/:id/finish', async (request) =>
    finishSession(deps, await requireActor(request), request.params.id),
  );
  app.get<SessionParams>('/api/study/sessions/:id/summary', async (request) =>
    summary(deps, await requireActor(request), request.params.id),
  );
  app.post<SessionParams>('/api/study/sessions/:id/retry-wrong', async (request, reply) =>
    reply.status(201).send(await retryWrong(deps, await requireActor(request), request.params.id)),
  );
}

/** One question of a session: reading it, answering it, and the AI's explanation (M9.4–M9.5). */
function registerItemRoutes(app: FastifyInstance, deps: StudyDeps, requireActor: RequireActor) {
  const base = '/api/study/sessions/:id/items/:position';
  app.get<ItemParams>(base, async (request) =>
    getItem(
      deps,
      await requireActor(request),
      request.params.id,
      positionOf(request.params.position),
    ),
  );
  app.post<ItemParams>(`${base}/answer`, async (request) => {
    const actor = await requireActor(request);
    const answer = parseInput(AnswerRequest, request.body);
    const ref = { sessionId: request.params.id, position: positionOf(request.params.position) };
    return answerItem(deps, actor, ref, answer);
  });
  app.post<ItemParams>(`${base}/ai-explanation`, async (request) => {
    const actor = await requireActor(request);
    const { instanceId } = parseInput(AiExplanationRequest, request.body);
    const ref = { sessionId: request.params.id, position: positionOf(request.params.position) };
    return explainWithAi(deps, actor, ref, instanceId);
  });
}

/** Exams: the map and clock, saving answers, flags, submission, and key-change impact (M10). */
function registerExamRoutes(app: FastifyInstance, deps: StudyDeps, requireActor: RequireActor) {
  const item = '/api/study/sessions/:id/items/:position';
  const ref = (request: { params: { id: string; position: string } }) => ({
    id: request.params.id,
    position: positionOf(request.params.position),
  });
  app.get<SessionParams>('/api/study/sessions/:id/exam', async (request) =>
    examState(deps, await requireActor(request), request.params.id),
  );
  app.post<ItemParams>(`${item}/open`, async (request) =>
    openExamItem(
      deps,
      await requireActor(request),
      request.params.id,
      positionOf(request.params.position),
    ),
  );
  app.put<ItemParams>(`${item}/choice`, async (request) => {
    const { chosen } = parseInput(ChoiceRequest, request.body);
    return saveChoice(deps, await requireActor(request), ref(request), chosen);
  });
  app.put<ItemParams>(`${item}/flag`, async (request) => {
    const { flagged } = parseInput(FlagRequest, request.body);
    return flagExamItem(deps, await requireActor(request), ref(request), flagged);
  });
  app.post<SessionParams>('/api/study/sessions/:id/submit', async (request, reply) => {
    const actor = await requireActor(request);
    parseInput(SubmitRequest, request.body);
    await submitExam(deps, actor, request.params.id);
    return reply.send(await getSession(deps, actor, request.params.id));
  });
  app.get<{ Querystring: { questionId?: string; answers?: string } }>(
    '/api/study/answer-impact',
    async (request) => {
      const answers = String(request.query.answers ?? '')
        .split(',')
        .filter((l) => /^[A-J]$/.test(l));
      return answerImpact(
        deps,
        await requireActor(request),
        String(request.query.questionId ?? ''),
        answers,
      );
    },
  );
}

const bankIdsOf = (raw: string | undefined) =>
  String(raw ?? '')
    .split(',')
    .filter(Boolean)
    .slice(0, 20);

/** The study plan: today's reviews, topics by need, one question's mastery (M11). */
function registerPlanRoutes(app: FastifyInstance, deps: StudyDeps, requireActor: RequireActor) {
  type Banks = { Querystring: { bankIds?: string } };
  app.get<Banks>('/api/study/due', async (request) =>
    dueToday(deps, await requireActor(request), bankIdsOf(request.query.bankIds)),
  );
  app.get<Banks>('/api/study/topics', async (request) =>
    topicPriorities(deps, await requireActor(request), bankIdsOf(request.query.bankIds)),
  );
  app.get<SessionParams>('/api/study/questions/:id/mastery', async (request) =>
    questionMastery(deps, await requireActor(request), request.params.id),
  );
}

export function registerStudyRoutes(
  app: FastifyInstance,
  deps: StudyDeps,
  requireActor: RequireActor,
) {
  registerSessionRoutes(app, deps, requireActor);
  registerItemRoutes(app, deps, requireActor);
  registerExamRoutes(app, deps, requireActor);
  registerPlanRoutes(app, deps, requireActor);
}
