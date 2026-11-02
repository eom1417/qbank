import type { FastifyInstance, InjectOptions } from 'fastify';
import { ORIGIN } from './test-app.js';

type Method = 'GET' | 'POST';

/** A cookie-carrying API client, like one browser profile. */
export function createClient(app: FastifyInstance) {
  let cookie = '';
  async function request(method: Method, url: string, payload?: object, origin = ORIGIN) {
    const options: InjectOptions = { method, url, headers: { origin, cookie } };
    if (payload) options.payload = payload;
    const response = await app.inject(options);
    const setCookie = response.cookies.find((c) => c.name === 'qb_session');
    if (setCookie) cookie = setCookie.value ? `qb_session=${setCookie.value}` : '';
    return response;
  }
  return {
    get: (url: string) => request('GET', url),
    post: (url: string, payload?: object, origin?: string) => request('POST', url, payload, origin),
  };
}

let counter = 0;

export function signUpPayload(overrides: Record<string, unknown> = {}) {
  counter += 1;
  return {
    email: `learner${counter}@example.test`,
    password: 'correct horse battery',
    displayName: `Learner ${counter}`,
    locale: 'ar',
    acceptTerms: true,
    ...overrides,
  };
}

/** A new browser profile signed in to a freshly registered account. */
export async function registeredBrowser(app: FastifyInstance) {
  const payload = signUpPayload();
  const browser = createClient(app);
  await browser.post('/api/auth/sign-up', payload);
  return { browser, payload };
}
