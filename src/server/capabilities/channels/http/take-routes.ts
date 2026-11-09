import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  StartAttemptRequest,
  TakeChoiceRequest,
  TakeFlagRequest,
  type TakeLandingResponse,
  type TakeStateResponse,
} from '../../../../contracts/take.js';
import { createRateLimit } from '../../../platform/http/rate-limit.js';
import { sendPng } from '../../../platform/http/send-png.js';
import { parseInput } from '../../../platform/http/validate.js';
import type { ChannelsDeps } from '../use-cases/deps.js';
import {
  attemptPicture,
  attemptResult,
  attemptState,
  chooseItem,
  flagItem,
  openItem,
  submitAttempt,
  takingOf,
} from '../use-cases/take-attempt.js';
import { landing, shareOfLink, startAttempt } from '../use-cases/take-links.js';

type TokenParams = { Params: { token: string } };
type PositionParams = { Params: { position: string } };
type IdParams = { Params: { id: string } };

/** Calls one link may take in a minute: a whole class opening it at once, not a flood. */
const LINK_PER_MINUTE = 600;
/** Calls one attempt may make in a minute: far above a person answering, far below a script. */
const ATTEMPT_PER_MINUTE = 120;

const BASE = '/api/take/v1';

/**
 * The people's side of exam/practice links (M30, DEC-39), version 1: no session and no cookie.
 * The link token opens the share; the attempt token (`Authorization: Bearer qba_…`) opens one
 * attempt only. Every call goes through the share's gate.
 */
export function registerTakeRoutes(app: FastifyInstance, deps: ChannelsDeps) {
  const linkLimit = createRateLimit({ limit: LINK_PER_MINUTE, windowMs: 60_000 });
  const attemptLimit = createRateLimit({ limit: ATTEMPT_PER_MINUTE, windowMs: 60_000 });
  const linkOf = async (token: string) => {
    const row = await shareOfLink(deps, token);
    linkLimit(row.id);
    return row;
  };
  const takingIn = async (request: FastifyRequest) => {
    const taking = await takingOf(deps, request.headers.authorization);
    attemptLimit(taking.attempt.id);
    return taking;
  };

  app.get<TokenParams>(`${BASE}/links/:token`, async (request): Promise<TakeLandingResponse> =>
    landing(deps, await linkOf(request.params.token)),
  );

  app.post<TokenParams>(`${BASE}/links/:token/attempts`, async (request, reply) => {
    const row = await linkOf(request.params.token);
    const started = await startAttempt(deps, row, parseInput(StartAttemptRequest, request.body));
    return reply.status(201).send(started);
  });

  app.get(`${BASE}/attempt`, async (request): Promise<TakeStateResponse> =>
    attemptState(deps, await takingIn(request)),
  );

  app.get(`${BASE}/attempt/result`, async (request) =>
    attemptResult(deps, await takingIn(request)),
  );

  app.post(`${BASE}/attempt/submit`, async (request) =>
    submitAttempt(deps, await takingIn(request)),
  );

  registerItemRoutes(app, deps, takingIn);

  app.get<IdParams>(`${BASE}/attempt/pictures/:id`, async (request, reply) =>
    sendPng(reply, await attemptPicture(deps, await takingIn(request), request.params.id)),
  );
}

type TakingIn = (request: FastifyRequest) => ReturnType<typeof takingOf>;

/** One question of the attempt: open it, answer it, flag it. */
function registerItemRoutes(app: FastifyInstance, deps: ChannelsDeps, takingIn: TakingIn) {
  const ITEM = `${BASE}/attempt/items/:position`;

  app.get<PositionParams>(ITEM, async (request) =>
    openItem(deps, await takingIn(request), request.params.position),
  );

  app.put<PositionParams>(ITEM, async (request) => {
    const taking = await takingIn(request);
    const { chosen } = parseInput(TakeChoiceRequest, request.body);
    return chooseItem(deps, taking, request.params.position, chosen);
  });

  app.post<PositionParams>(`${ITEM}/flag`, async (request) => {
    const taking = await takingIn(request);
    const { flagged } = parseInput(TakeFlagRequest, request.body);
    return flagItem(deps, taking, request.params.position, flagged);
  });
}
