import type { AiHostClient } from '../../../platform/ai-host/client.js';
import type { AiProvider } from '../domain/ai-provider.js';
import { kitProvider } from './kit-ai.js';

interface InstanceSummary {
  instanceId: string;
  enabled: boolean;
  supportsTextGeneration?: boolean;
}

/** The instance, when it exists in the kit and is on (a disabled one never runs a turn). */
async function usableInstance(client: AiHostClient, owner: string, instanceId: string) {
  const state = await client.read('/state', owner).catch(() => null);
  const providers = ((state?.body as { providers?: InstanceSummary[] } | null)?.providers ??
    []) as InstanceSummary[];
  return providers.find(
    (p) => p.instanceId === instanceId && p.enabled && p.supportsTextGeneration !== false,
  );
}

/**
 * What imports need from the user's AI (sources' `deps.ai`), served by the kit: open an
 * instance for an account, and a cost estimate. A subscription has no per-page price, so
 * nothing needs approval; the kit reports usage limits itself.
 */
export function kitImportAi(client: AiHostClient) {
  return {
    async openOwned(ownerId: string, instanceId: string): Promise<AiProvider | null> {
      const owner = `account:${ownerId}`;
      return (await usableInstance(client, owner, instanceId))
        ? kitProvider(client, owner, instanceId)
        : null;
    },
    async estimateFor(ownerId: string, instanceId: string) {
      const found = await usableInstance(client, `account:${ownerId}`, instanceId);
      return found ? { needsApproval: false, reasons: [] as string[] } : null;
    },
  };
}
