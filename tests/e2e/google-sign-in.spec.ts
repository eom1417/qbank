import { createHash, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { expect, test, type Page } from '@playwright/test';
import { AR } from './support.js';

/**
 * Google-only server (M32, DEC-42), end to end in a real browser. It needs its own API in Google
 * mode behind its own Vite (playwright.config.ts), pointed at the fake Google this spec runs:
 *   QBANK_GOOGLE_CLIENT_ID=<CLIENT_ID>, QBANK_GOOGLE_CLIENT_SECRET=<CLIENT_SECRET>,
 *   QBANK_GOOGLE_AUTH_URL=<FAKE_GOOGLE>/auth, QBANK_GOOGLE_TOKEN_URL=<FAKE_GOOGLE>/token,
 *   QBANK_ALLOWED_ORIGINS=<GOOGLE_WEB_URL>, QBANK_OPERATOR_EMAIL=<OPERATOR_EMAIL>,
 *   QBANK_OPERATOR_NAME=<OPERATOR_NAME>, and no QBANK_BACKUP_STATUS_FILE.
 */
const GOOGLE_WEB_URL = 'http://127.0.0.1:5182';
const FAKE_GOOGLE_PORT = 3194;
const CLIENT_ID = 'e2e-google-client.apps.googleusercontent.com';
const CLIENT_SECRET = 'e2e-google-secret-not-a-secret';
const OPERATOR_EMAIL = 'google-operator@example.test';
const OPERATOR_NAME = 'أبو سالم';

const CONTINUE = 'متابعة بحساب Google';

interface Person {
  sub: string;
  email: string;
  name: string;
  email_verified: boolean;
}

/** Who picks their account on the fake consent screen next; each test sets it first. */
let chosen: Person;
const codes = new Map<string, { person: Person; nonce: string; challenge: string }>();

const unique = () => `${Date.now()}-${randomBytes(3).toString('hex')}`;
const person = (tag: string, changes: Partial<Person> = {}): Person => {
  const id = unique();
  return {
    sub: `sub-${id}`,
    email: `${tag}-${id}@gmail.test`,
    name: `Google ${tag}`,
    email_verified: true,
    ...changes,
  };
};

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

/** The consent screen: the chosen person, straight back to the app's callback with a code. */
function consent(url: URL): string {
  const code = randomBytes(16).toString('base64url');
  const nonce = url.searchParams.get('nonce') ?? '';
  codes.set(code, {
    person: chosen,
    nonce,
    challenge: url.searchParams.get('code_challenge') ?? '',
  });
  const back = new URL(url.searchParams.get('redirect_uri') ?? '');
  back.search = new URLSearchParams({
    code,
    state: url.searchParams.get('state') ?? '',
  }).toString();
  return back.toString();
}

/** The code exchange: right client and PKCE verifier, then an id_token for the chosen person. */
function exchange(form: URLSearchParams): object | null {
  const grant = codes.get(form.get('code') ?? '');
  codes.delete(form.get('code') ?? '');
  const proof = createHash('sha256')
    .update(form.get('code_verifier') ?? '')
    .digest('base64url');
  const client = form.get('client_id') === CLIENT_ID && form.get('client_secret') === CLIENT_SECRET;
  if (!grant || !client || proof !== grant.challenge) return null;
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    ...grant.person,
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    nonce: grant.nonce,
    iat: now,
    exp: now + 600,
  };
  return {
    access_token: 'e2e',
    token_type: 'Bearer',
    id_token: `${encode({ alg: 'RS256' })}.${encode(claims)}.e2e`,
  };
}

const body = (request: IncomingMessage) =>
  new Promise<URLSearchParams>((resolve) => {
    let text = '';
    request.on('data', (chunk: Buffer) => (text += chunk.toString('utf8')));
    request.on('end', () => resolve(new URLSearchParams(text)));
  });

let google: Server;
test.beforeAll(async () => {
  google = createServer((request, response) => {
    const url = new URL(request.url ?? '/', `http://127.0.0.1:${FAKE_GOOGLE_PORT}`);
    if (url.pathname === '/auth') return response.writeHead(302, { location: consent(url) }).end();
    void body(request).then((form) => {
      const tokens = exchange(form);
      response.writeHead(tokens ? 200 : 400, { 'content-type': 'application/json' });
      response.end(JSON.stringify(tokens ?? { error: 'invalid_grant' }));
    });
  });
  await new Promise<void>((resolve) => google.listen(FAKE_GOOGLE_PORT, '127.0.0.1', resolve));
});
test.afterAll(() => new Promise<void>((resolve) => google.close(() => resolve())));

const at = (path: string) => `${GOOGLE_WEB_URL}${path}`;

/** Creates an account through the sign-up screen: terms first, then Google. */
async function signUpWithGoogle(page: Page, who: Person) {
  chosen = who;
  await page.goto(at('/sign-up'));
  const button = page.getByRole('button', { name: CONTINUE });
  await expect(button).toBeDisabled();
  await page.getByLabel(AR.terms).check();
  await button.click();
  await expect(page.getByRole('heading', { name: 'مكتبتك فارغة' })).toBeVisible();
}

test('sign-up is one Google button behind the terms, with no password anywhere', async ({
  page,
}) => {
  await page.goto(at('/sign-up'));
  await expect(page.getByText(`هذا الموقع يديره ${OPERATOR_NAME}.`)).toBeVisible();
  await expect(page.getByLabel(AR.password)).toHaveCount(0);
  const someone = person('signup');
  await signUpWithGoogle(page, someone);
  await page.getByRole('link', { name: 'الإعدادات' }).click();
  await expect(page.getByText('تدخل بحساب Google:')).toBeVisible();
  await expect(page.getByText(someone.email)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'تغيير كلمة المرور' })).toHaveCount(0);
});

test('an existing account signs in with Google and lands where it was going', async ({
  browser,
  page,
}) => {
  const someone = person('again');
  await signUpWithGoogle(page, someone);
  const fresh = await (await browser.newContext({ locale: 'ar-SA' })).newPage();
  chosen = someone;
  await fresh.goto(at('/sign-in?next=%2Fsharing'));
  await expect(fresh.getByRole('link', { name: 'نسيت كلمة المرور؟' })).toHaveCount(0);
  await expect(fresh.getByLabel(AR.password)).toHaveCount(0);
  await fresh.getByRole('button', { name: CONTINUE }).click();
  await expect(fresh).toHaveURL(at('/sharing'));
});

test('a new person on sign-in is sent to accept the terms first', async ({ page }) => {
  chosen = person('newcomer');
  await page.goto(at('/sign-in'));
  await page.getByRole('button', { name: CONTINUE }).click();
  await expect(page).toHaveURL(at('/sign-up?error=terms'));
  await expect(page.getByText('وافق على الشروط أولاً لإنشاء حسابك.')).toBeVisible();
});

test('an e-mail Google has not verified is refused with a clear message', async ({ page }) => {
  chosen = person('unverified', { email_verified: false });
  await page.goto(at('/sign-in'));
  await page.getByRole('button', { name: CONTINUE }).click();
  await expect(page).toHaveURL(at('/sign-in?error=google'));
  await expect(page.getByText('تعذّر الدخول بحساب Google. حاول مرة أخرى.')).toBeVisible();
});

test('the password screens do not exist: they go to sign-in', async ({ page }) => {
  for (const path of ['/forgot-password', '/reset-password#token=x']) {
    await page.goto(at(path));
    await expect(page).toHaveURL(at('/sign-in'));
    await expect(page.getByRole('button', { name: CONTINUE })).toBeVisible();
  }
});

test('the operator is in at once, sees the missing backup, and no password resets', async ({
  page,
}) => {
  chosen = person('operator', { email: OPERATOR_EMAIL, sub: 'e2e-google-operator' });
  await page.goto(at('/sign-up'));
  await page.getByLabel(AR.terms).check();
  await page.getByRole('button', { name: CONTINUE }).click();
  await page.getByRole('link', { name: 'الإدارة' }).click();
  await expect(page.getByRole('heading', { name: 'إدارة الخادم' })).toBeVisible();
  await expect(page.getByText('لم تُنفَّذ نسخة احتياطية بعد على هذا الخادم.')).toBeVisible();
  await expect(page.getByText('طلبات استعادة كلمة المرور')).toHaveCount(0);
});
