import type {
  AiSettings,
  EstimateRequest,
  EstimateResponse,
  UpdateAiSettingsRequest,
} from '../../../../contracts/ai.js';
import type { Actor } from '../../identity/index.js';
import { approvalReasons, DEFAULT_AI_SETTINGS, estimateCost } from '../domain/cost.js';
import type { ProviderConnection } from '../domain/provider.js';
import type { AiDeps } from './deps.js';

export async function getAiSettings(deps: AiDeps, actor: Actor): Promise<AiSettings> {
  return (await deps.settings.get(actor.accountId)) ?? DEFAULT_AI_SETTINGS;
}

export async function updateAiSettings(
  deps: AiDeps,
  actor: Actor,
  input: UpdateAiSettingsRequest,
): Promise<AiSettings> {
  const current = await getAiSettings(deps, actor);
  const settings: AiSettings = {
    costLimitUsd: input.costLimitUsd === undefined ? current.costLimitUsd : input.costLimitUsd,
    approvalPages: input.approvalPages ?? current.approvalPages,
  };
  await deps.settings.save(actor.accountId, settings);
  return settings;
}

/** The estimate and approval for a task on `pages` with this connection (null = no AI). */
async function estimateWith(
  deps: AiDeps,
  ownerId: string,
  provider: ProviderConnection | undefined,
  input: EstimateRequest,
): Promise<EstimateResponse> {
  const pricing = provider ?? { inputPrice: null, outputPrice: null };
  const estimate = estimateCost(input.pages, input.imagePages, pricing);
  const settings = (await deps.settings.get(ownerId)) ?? DEFAULT_AI_SETTINGS;
  const reasons = provider ? approvalReasons(input.pages, estimate.costUsd, settings) : [];
  return {
    provider: provider ? { id: provider.id, label: provider.label, kind: provider.kind } : null,
    ...estimate,
    needsApproval: reasons.length > 0,
    reasons,
  };
}

/**
 * Honest estimate for an AI task on a file, with the default provider the task would use
 * (FR-08-010, FR-08-012). Without a provider nothing can run, so nothing is asked (FR-08-013).
 */
export async function estimateTask(deps: AiDeps, actor: Actor, input: EstimateRequest) {
  return estimateWith(
    deps,
    actor.accountId,
    await deps.providers.findDefault(actor.accountId),
    input,
  );
}

/** The same estimate for one of the owner's connections, chosen for an import. */
export async function estimateForConnection(
  deps: AiDeps,
  ownerId: string,
  providerId: string,
  pages: number,
) {
  const provider = await deps.providers.find({ ownerId, id: providerId });
  if (!provider) return null;
  return estimateWith(deps, ownerId, provider, { pages, imagePages: pages });
}
