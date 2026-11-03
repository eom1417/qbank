import type {
  CreateProviderRequest,
  ListModelsRequest,
  ProviderKind,
  UpdateProviderRequest,
} from '../../../../contracts/ai.js';
import { AppError, notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { Actor } from '../../identity/index.js';
import type { ProviderChanges } from '../adapters/provider-repository.js';
import { keyContext, keyHint, type ProviderConnection } from '../domain/provider.js';
import type { AiDeps } from './deps.js';

const invalidField = (field: string, code: string) =>
  new AppError('validation_failed', { [field]: code });

async function requireSafeUrl(deps: AiDeps, url: string | undefined) {
  if (url !== undefined && !(await deps.isAllowedUrl(url))) throw invalidField('baseUrl', 'unsafe');
}

const ownedRef = (actor: Actor, id: string) => {
  if (!isId(id)) throw notFound();
  return { ownerId: actor.accountId, id };
};

/** Seals a new key for this row; `null` removes it. */
function keyChanges(deps: AiDeps, ref: { ownerId: string; id: string }, key: string | null) {
  if (key === null) return { keyCiphertext: null, keyHint: null };
  return { keyCiphertext: deps.secretBox.seal(key, keyContext(ref)), keyHint: keyHint(key) };
}

export const listProviders = (deps: AiDeps, actor: Actor) => deps.providers.list(actor.accountId);

/** A new, unchecked connection; the key (if any) is sealed for this row only. */
function newConnection(
  deps: AiDeps,
  actor: Actor,
  input: CreateProviderRequest,
  isDefault: boolean,
) {
  const now = deps.clock.now();
  const ref = { ownerId: actor.accountId, id: deps.newId() };
  const connection: ProviderConnection = {
    ...ref,
    kind: input.kind,
    label: input.label,
    model: input.model,
    baseUrl: input.baseUrl,
    ...keyChanges(deps, ref, input.apiKey ?? null),
    // The user's own provider prices; unknown stays null (no invented bill, FR-08-012).
    inputPrice: input.inputPrice,
    outputPrice: input.outputPrice,
    isDefault,
    readinessStatus: 'unchecked',
    readinessCheckedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  return connection;
}

/** The Claude API always needs the user's own key (never this server's credentials). */
function requireKeyFor(kind: ProviderKind, hasKey: boolean) {
  if (kind === 'anthropic' && !hasKey) throw invalidField('apiKey', 'required');
}

export async function createProvider(
  deps: AiDeps,
  actor: Actor,
  input: CreateProviderRequest,
): Promise<ProviderConnection> {
  requireKeyFor(input.kind, input.apiKey !== undefined);
  await requireSafeUrl(deps, input.baseUrl);
  const isFirst = (await deps.providers.list(actor.accountId)).length === 0;
  const connection = newConnection(deps, actor, input, isFirst);
  await deps.providers.insert(connection);
  return connection;
}

/** Lists the models a key may use without saving anything (the key is used once, in memory). */
export async function listModelsFor(deps: AiDeps, input: ListModelsRequest) {
  requireKeyFor(input.kind, input.apiKey !== undefined);
  await requireSafeUrl(deps, input.baseUrl);
  return deps.listModels({ ...input, apiKey: input.apiKey ?? null, model: '' });
}

/** A new key, URL or model invalidates what the last check found. */
const invalidatesReadiness = (input: UpdateProviderRequest) =>
  input.apiKey !== undefined || input.baseUrl !== undefined || input.model !== undefined;

export async function updateProvider(
  deps: AiDeps,
  actor: Actor,
  id: string,
  input: UpdateProviderRequest,
): Promise<ProviderConnection> {
  const ref = ownedRef(actor, id);
  const current = await deps.providers.find(ref);
  if (!current) throw notFound();
  if (input.apiKey === null) requireKeyFor(current.kind, false);
  await requireSafeUrl(deps, input.baseUrl);
  const { apiKey, ...rest } = input;
  const changes: ProviderChanges = { ...rest, updatedAt: deps.clock.now() };
  if (apiKey !== undefined) Object.assign(changes, keyChanges(deps, ref, apiKey));
  if (invalidatesReadiness(input)) {
    Object.assign(changes, { readinessStatus: 'unchecked', readinessCheckedAt: null });
  }
  const updated = await deps.providers.update(ref, changes);
  if (!updated) throw notFound();
  return updated;
}

export async function makeDefaultProvider(deps: AiDeps, actor: Actor, id: string) {
  if (!(await deps.providers.setDefault(ownedRef(actor, id)))) throw notFound();
}

/** Revoking deletes the sealed key with its row (FR-22-002). */
export async function deleteProvider(deps: AiDeps, actor: Actor, id: string) {
  if (!(await deps.providers.delete(ownedRef(actor, id)))) throw notFound();
}

export async function findOwnedProvider(deps: AiDeps, actor: Actor, id: string) {
  const connection = await deps.providers.find(ownedRef(actor, id));
  if (!connection) throw notFound();
  return connection;
}
