import type { CreateProviderRequest, UpdateProviderRequest } from '../../../../contracts/ai.js';
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
  const external = input.kind === 'openai_compatible' ? input : null;
  const connection: ProviderConnection = {
    ...ref,
    kind: input.kind,
    label: input.label,
    model: input.model,
    baseUrl: external?.baseUrl ?? null,
    ...keyChanges(deps, ref, external?.apiKey ?? null),
    // The operator's local server costs the user nothing; external prices are the user's own.
    inputPrice: external ? external.inputPrice : 0,
    outputPrice: external ? external.outputPrice : 0,
    isDefault,
    readinessStatus: 'unchecked',
    readinessCheckedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  return connection;
}

export async function createProvider(
  deps: AiDeps,
  actor: Actor,
  input: CreateProviderRequest,
): Promise<ProviderConnection> {
  if (input.kind === 'local' && !deps.localUrl) throw invalidField('kind', 'unavailable');
  if (input.kind === 'openai_compatible') await requireSafeUrl(deps, input.baseUrl);
  const isFirst = (await deps.providers.list(actor.accountId)).length === 0;
  const connection = newConnection(deps, actor, input, isFirst);
  await deps.providers.insert(connection);
  return connection;
}

/** The local server's address comes from the operator and it takes no key. */
function requireEditableFields(current: ProviderConnection, input: UpdateProviderRequest) {
  if (current.kind !== 'local') return;
  if (input.baseUrl !== undefined) throw invalidField('baseUrl', 'unavailable');
  if (input.apiKey !== undefined) throw invalidField('apiKey', 'unavailable');
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
  requireEditableFields(current, input);
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
