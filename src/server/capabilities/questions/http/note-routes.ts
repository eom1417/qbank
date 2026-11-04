import type { FastifyInstance } from 'fastify';
import {
  NoteRequest,
  ReportRequest,
  type NotesResponse,
  type ReportsResponse,
} from '../../../../contracts/review.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { RequireActor } from '../../identity/index.js';
import {
  addNote,
  deleteNote,
  notesOf,
  reportQuestion,
  reportsOf,
  resolveReport,
  searchNotes,
} from '../use-cases/notes.js';
import type { ReviewDeps } from '../use-cases/question-actions.js';

type IdParams = { Params: { id: string } };

/** Private review notes (M7.8) and study reports (M7.9). */
export function registerNoteRoutes(
  app: FastifyInstance,
  deps: ReviewDeps,
  requireActor: RequireActor,
) {
  app.get<IdParams>('/api/questions/:id/notes', async (request): Promise<NotesResponse> =>
    notesOf(deps, await requireActor(request), request.params.id),
  );
  app.post<IdParams>('/api/questions/:id/notes', async (request, reply) => {
    const actor = await requireActor(request);
    const note = parseInput(NoteRequest, request.body);
    return reply.status(201).send(await addNote(deps, actor, request.params.id, note));
  });
  app.get<{ Querystring: { q?: string } }>(
    '/api/review-notes',
    async (request): Promise<NotesResponse> =>
      searchNotes(deps, await requireActor(request), String(request.query.q ?? '').slice(0, 200)),
  );
  app.delete<IdParams>('/api/review-notes/:id', async (request, reply) => {
    await deleteNote(deps, await requireActor(request), request.params.id);
    return reply.status(204).send();
  });
  app.get<IdParams>('/api/questions/:id/reports', async (request): Promise<ReportsResponse> =>
    reportsOf(deps, await requireActor(request), request.params.id),
  );
  app.post<IdParams>('/api/questions/:id/reports', async (request, reply) => {
    const actor = await requireActor(request);
    const report = parseInput(ReportRequest, request.body);
    return reply.status(201).send(await reportQuestion(deps, actor, request.params.id, report));
  });
  app.post<IdParams>('/api/reports/:id/resolve', async (request, reply) => {
    await resolveReport(deps, await requireActor(request), request.params.id);
    return reply.status(204).send();
  });
}
