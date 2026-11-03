import type { StartAccountLoginRequest } from '../../../../contracts/ai.js';
import { notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { Actor } from '../../identity/index.js';
import { accountKindOf, type CompletedLogin } from '../adapters/accounts/index.js';
import { keyContext, type ProviderConnection } from '../domain/provider.js';
import type { AiDeps } from './deps.js';

const LABELS = { claude: 'Claude', codex: 'ChatGPT (Codex)' } as const;
const DEFAULT_MODELS = { claude: 'sonnet', codex: 'default' } as const;

/**
 * Saves a finished sign-in as a connection: the CLI's login is sealed for this row only, like
 * a key. Usage is billed to the user's subscription, so the estimate is zero (FR-08-012).
 */
export async function saveAccountLogin(deps: AiDeps, login: CompletedLogin): Promise<string> {
  const now = deps.clock.now();
  const ref = { ownerId: login.ownerId, id: deps.newId() };
  const isFirst = (await deps.providers.list(login.ownerId)).length === 0;
  const email = login.identity.email;
  const connection: ProviderConnection = {
    ...ref,
    kind: accountKindOf(login.provider),
    label: email ? `${LABELS[login.provider]} — ${email}` : LABELS[login.provider],
    baseUrl: null,
    model: DEFAULT_MODELS[login.provider],
    keyCiphertext: deps.secretBox.seal(login.credential, keyContext(ref)),
    keyHint: null,
    accountEmail: email,
    accountPlan: login.identity.plan,
    inputPrice: 0,
    outputPrice: 0,
    isDefault: isFirst,
    readinessStatus: 'ready',
    readinessCheckedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  await deps.providers.insert(connection);
  return connection.id;
}

/** Seals a login the CLI refreshed during a run (tokens rotate). */
export async function saveRefreshedLogin(
  deps: AiDeps,
  connection: ProviderConnection,
  credential: string,
) {
  const ref = { ownerId: connection.ownerId, id: connection.id };
  const keyCiphertext = deps.secretBox.seal(credential, keyContext(ref));
  await deps.providers.update(ref, { keyCiphertext, updatedAt: deps.clock.now() });
}

export const startAccountLogin = (deps: AiDeps, actor: Actor, input: StartAccountLoginRequest) =>
  deps.logins.start(actor.accountId, input.provider);

function found<T>(value: T | undefined | false): T {
  if (value === undefined || value === false) throw notFound();
  return value;
}

export const getAccountLogin = (deps: AiDeps, actor: Actor, id: string) =>
  found(isId(id) && deps.logins.get(actor.accountId, id));

export const submitLoginCode = (deps: AiDeps, actor: Actor, id: string, code: string) =>
  found(isId(id) && deps.logins.submitCode(actor.accountId, id, code));

export const cancelAccountLogin = (deps: AiDeps, actor: Actor, id: string) => {
  found(isId(id) && deps.logins.cancel(actor.accountId, id));
};
