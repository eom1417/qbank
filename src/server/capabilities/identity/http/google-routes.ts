import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { GoogleConfig } from '../../../platform/config/index.js';
import { createAttemptLimiter } from '../../../platform/http/attempts.js';
import { authorizationUrl } from '../adapters/google-client.js';
import { createFlowStore, FLOW_TTL_MS, type PendingFlow } from '../adapters/google-flows.js';
import { generateToken, sameToken } from '../adapters/tokens.js';
import { localeFrom, safeNext } from '../domain/google-identity.js';
import type { IdentityDeps } from '../use-cases/deps.js';
import { personFromCode, signInWithGoogle } from '../use-cases/google-sign-in.js';
import { setSessionCookie } from './session-cookie.js';

export interface GoogleRouteOptions {
  deps: IdentityDeps;
  google: GoogleConfig;
  cookieSecure: boolean;
  /** The app's configured origin: Google sends the browser back there, never to a header. */
  publicOrigin: string | null;
}

const FLOW_COOKIE = 'qb_google';
const PATH = '/api/auth/google';
const callbackUrl = (origin: string) => `${origin}${PATH}/callback`;
/** Where the browser lands when something failed: the sign-in screen, never an error page. */
const FAILED = '/sign-in?error=google';
const LIMITED = '/sign-in?error=too_many_attempts';
const NO_TERMS = '/sign-up?error=terms';

type Query = Record<string, unknown>;

interface Callback {
  options: GoogleRouteOptions;
  request: FastifyRequest<{ Querystring: Query }>;
  reply: FastifyReply;
  flow: PendingFlow | null;
}

/** Where the callback sends the browser; signs it in on the way when Google vouched. */
async function callbackTarget({ options, request, reply, flow }: Callback): Promise<string> {
  const { code, state } = request.query;
  const answered = typeof code === 'string' && typeof state === 'string';
  if (!flow || !options.publicOrigin || !answered || !sameToken(state, flow.state)) return FAILED;
  const { deps, google } = options;
  const redirectUri = callbackUrl(options.publicOrigin);
  const person = await personFromCode(google, { ...flow, redirectUri }, code, deps.clock.now());
  if (!person) return FAILED;
  const locale = localeFrom(request.headers['accept-language']);
  const outcome = await signInWithGoogle(deps, person, { acceptTerms: flow.acceptTerms, locale });
  if (outcome.kind === 'terms_required') return NO_TERMS;
  if (outcome.kind === 'refused') return FAILED;
  setSessionCookie(reply, outcome.signedIn.session, options.cookieSecure);
  return flow.next;
}

/** Any unexpected failure still lands on the sign-in screen; nothing secret is logged. */
async function safeCallbackTarget(callback: Callback): Promise<string> {
  try {
    return await callbackTarget(callback);
  } catch (error) {
    callback.request.log.error({ err: error }, 'google sign-in failed');
    return FAILED;
  }
}

const newFlow = (query: Query): PendingFlow => ({
  state: generateToken(),
  nonce: generateToken(),
  codeVerifier: generateToken(),
  next: safeNext(query['next']),
  acceptTerms: query['acceptTerms'] === '1',
});

/** "Continue with Google" (M32, DEC-42): the OpenID Connect code flow with PKCE. */
export function registerGoogleRoutes(app: FastifyInstance, options: GoogleRouteOptions) {
  const { deps, google, publicOrigin } = options;
  const flows = createFlowStore(() => deps.clock.now());
  const window = { windowMs: 15 * 60_000, now: () => deps.clock.now() };
  // Every start per address (each holds a flow in memory) and every failed callback per address.
  const starts = createAttemptLimiter({ max: 60, ...window });
  const failures = createAttemptLimiter({ max: 20, ...window });
  const cookie = {
    httpOnly: true,
    sameSite: 'lax',
    secure: options.cookieSecure,
    path: PATH,
  } as const;

  app.get<{ Querystring: Query }>(`${PATH}/start`, async (request, reply) => {
    if (starts.blocked(request.ip)) return reply.redirect(LIMITED);
    starts.fail(request.ip);
    if (!publicOrigin) return reply.redirect(FAILED);
    const flow = newFlow(request.query);
    const redirectUri = callbackUrl(publicOrigin);
    reply.setCookie(FLOW_COOKIE, flows.open(flow), { ...cookie, maxAge: FLOW_TTL_MS / 1000 });
    return reply.redirect(authorizationUrl(google, { ...flow, redirectUri }));
  });

  app.get<{ Querystring: Query }>(`${PATH}/callback`, async (request, reply) => {
    const flow = flows.take(request.cookies[FLOW_COOKIE]);
    reply.clearCookie(FLOW_COOKIE, cookie);
    if (failures.blocked(request.ip)) return reply.redirect(LIMITED);
    const target = await safeCallbackTarget({ options, request, reply, flow });
    if (target === FAILED) failures.fail(request.ip);
    return reply.redirect(target);
  });
}
