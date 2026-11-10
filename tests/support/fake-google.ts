import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll } from 'vitest';
import type { GoogleConfig } from '../../src/server/platform/config/index.js';
import type { Db } from '../../src/server/platform/db/index.js';
import { ORIGIN } from './test-app.js';

/** A person as Google knows them. */
export interface GooglePerson {
  sub: string;
  email: string;
  name?: string;
  emailVerified?: boolean;
}

/** Claims the fake puts in the id_token instead of the right ones (aud, nonce, iss, exp...). */
export type ClaimOverrides = Record<string, unknown>;

interface Grant {
  person: GooglePerson;
  nonce: string;
  challenge: string;
  redirectUri: string;
  overrides: ClaimOverrides;
}

const CLIENT_ID = 'qbank-test-client.apps.googleusercontent.com';
const CLIENT_SECRET = 'fake-google-client-secret-not-a-secret';

const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

/** An id_token shaped like Google's: the server verifies its claims, never its signature. */
function idToken(grant: Grant, now: Date) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const claims = {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    azp: CLIENT_ID,
    sub: grant.person.sub,
    email: grant.person.email,
    email_verified: grant.person.emailVerified ?? true,
    name: grant.person.name,
    nonce: grant.nonce,
    iat: issuedAt,
    exp: issuedAt + 3600,
    ...grant.overrides,
  };
  return `${base64url({ alg: 'RS256', typ: 'JWT' })}.${base64url(claims)}.fake-signature`;
}

function readForm(request: IncomingMessage): Promise<URLSearchParams> {
  return new Promise((resolve) => {
    let body = '';
    request.on('data', (chunk: Buffer) => (body += chunk.toString('utf8')));
    request.on('end', () => resolve(new URLSearchParams(body)));
  });
}

const reply = (response: ServerResponse, status: number, body: object) => {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
};

/** Google's checks of the code exchange: the client, the redirect and the PKCE verifier. */
function grantFor(form: URLSearchParams, grants: Map<string, Grant>): Grant | null {
  const grant = grants.get(form.get('code') ?? '');
  grants.delete(form.get('code') ?? '');
  const verifier = form.get('code_verifier') ?? '';
  const checks = [
    grant !== undefined,
    form.get('grant_type') === 'authorization_code',
    form.get('client_id') === CLIENT_ID,
    form.get('client_secret') === CLIENT_SECRET,
    form.get('redirect_uri') === grant?.redirectUri,
    createHash('sha256').update(verifier).digest('base64url') === grant?.challenge,
  ];
  return checks.every(Boolean) ? (grant ?? null) : null;
}

/**
 * A local Google for one suite: its token endpoint runs on a real port, and `authorize` plays the
 * consent screen. `config` is filled in before the suite's app starts (register this first).
 */
export function useFakeGoogle(now: () => Date = () => new Date()) {
  const grants = new Map<string, Grant>();
  const exchanges = { count: 0 };
  const config: GoogleConfig = {
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    authUrl: '',
    tokenUrl: '',
  };
  const server = createServer((request, response) => {
    void readForm(request).then((form) => {
      exchanges.count += 1;
      const grant = request.url === '/token' ? grantFor(form, grants) : null;
      if (!grant) return reply(response, 400, { error: 'invalid_grant' });
      const tokens = { access_token: 'fake-access', token_type: 'Bearer', expires_in: 3599 };
      reply(response, 200, { ...tokens, id_token: idToken(grant, now()) });
    });
  });
  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    config.authUrl = `http://127.0.0.1:${port}/auth`;
    config.tokenUrl = `http://127.0.0.1:${port}/token`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  /** The person picks their account: the callback URL Google sends the browser back to. */
  function authorize(startLocation: string, person: GooglePerson, overrides: ClaimOverrides = {}) {
    const asked = new URL(startLocation).searchParams;
    if (asked.get('client_id') !== CLIENT_ID || asked.get('code_challenge_method') !== 'S256')
      throw new Error('fake Google: bad authorization request');
    const code = randomBytes(16).toString('base64url');
    const redirectUri = asked.get('redirect_uri') ?? '';
    const challenge = asked.get('code_challenge') ?? '';
    grants.set(code, {
      person,
      nonce: asked.get('nonce') ?? '',
      challenge,
      redirectUri,
      overrides,
    });
    const back = new URL(redirectUri);
    back.search = new URLSearchParams({ code, state: asked.get('state') ?? '' }).toString();
    return back.toString();
  }
  return { config, authorize, exchanges };
}

type FakeGoogle = ReturnType<typeof useFakeGoogle>;

/** Where a response redirects to, relative to the app when it is the app's own page. */
export const locationOf = (response: LightMyRequestResponse) => {
  const location = String(response.headers.location ?? '');
  return location.startsWith('/') ? location : new URL(location).toString();
};

const pathOf = (url: string) => {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
};

/** A browser that goes through "Continue with Google" against the fake, carrying its cookies. */
export function googleBrowser(app: FastifyInstance, google: FakeGoogle) {
  const cookies = new Map<string, string>();
  const header = () => [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  async function request(method: 'GET' | 'POST', url: string, payload?: object) {
    const headers = { cookie: header(), origin: ORIGIN };
    const response = await app.inject({ method, url, headers, ...(payload ? { payload } : {}) });
    for (const set of response.cookies) {
      if (set.value && (set.maxAge ?? 1) > 0) cookies.set(set.name, set.value);
      else cookies.delete(set.name);
    }
    return response;
  }
  const get = (url: string) => request('GET', url);
  /** The whole round trip: start, Google's consent, callback. Returns the callback response. */
  async function signIn(person: GooglePerson, options: SignInOptions = {}) {
    const start = await get(`/api/auth/google/start${options.query ?? '?acceptTerms=1'}`);
    const callback = google.authorize(locationOf(start), person, options.claims);
    return get(options.tamper ? options.tamper(pathOf(callback)) : pathOf(callback));
  }
  return {
    get,
    post: (url: string, payload: object = {}) => request('POST', url, payload),
    signIn,
  };
}

interface SignInOptions {
  /** The start's query string (default `?acceptTerms=1`). */
  query?: string;
  claims?: ClaimOverrides;
  /** Changes the callback path before the browser follows it (a forged state, say). */
  tamper?: (callbackPath: string) => string;
}

/**
 * An account written straight into the database, with a live session, as an earlier mode of the
 * server left it: a password account (`passwordHash`) or one made by Google (`googleSub`).
 * Returns its id and the session's cookie header.
 */
export async function seedAccount(
  db: Db,
  account: { email: string; passwordHash: string | null; googleSub?: string },
) {
  const id = randomUUID();
  const token = randomBytes(32).toString('base64url');
  await db
    .insertInto('account')
    .values({
      id,
      email: account.email,
      password_hash: account.passwordHash,
      google_sub: account.googleSub ?? null,
      display_name: 'Seeded person',
      locale: 'ar',
      terms_accepted_at: new Date(),
    })
    .execute();
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 3_600_000);
  await db
    .insertInto('auth_session')
    .values({ token_hash: tokenHash, account_id: id, expires_at: expiresAt })
    .execute();
  return { id, cookie: `qb_session=${token}` };
}
