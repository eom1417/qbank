import { generateToken } from './tokens.js';

/** A Google sign-in started in one browser and not finished yet (M32, DEC-42). */
export interface PendingFlow {
  state: string;
  nonce: string;
  codeVerifier: string;
  /** Where to go afterwards: already a safe path of this app. */
  next: string;
  /** The person accepted the terms before leaving for Google (needed to create an account). */
  acceptTerms: boolean;
}

/** How long a started sign-in stays usable. */
export const FLOW_TTL_MS = 10 * 60_000;
/** Started sign-ins held at once; past this the oldest are dropped, so floods cannot fill memory. */
const MAX_FLOWS = 10_000;

/**
 * Started sign-ins, in memory, by a random key that only the browser's cookie carries. The
 * cookie holds none of the flow's secrets; each flow is taken once. A restart forgets them all,
 * which only means starting again.
 */
export function createFlowStore(now: () => Date) {
  const flows = new Map<string, PendingFlow & { expiresAt: number }>();
  const prune = () => {
    for (const [key, flow] of flows) {
      if (flows.size <= MAX_FLOWS && flow.expiresAt > now().getTime()) break;
      flows.delete(key);
    }
  };
  return {
    /** Keeps the flow and returns its key (the cookie's value). */
    open(flow: PendingFlow): string {
      const key = generateToken();
      flows.set(key, { ...flow, expiresAt: now().getTime() + FLOW_TTL_MS });
      prune();
      return key;
    },
    /** The flow behind this key, once; null when unknown or expired. */
    take(key: string | undefined): PendingFlow | null {
      const flow = key === undefined ? undefined : flows.get(key);
      if (key !== undefined) flows.delete(key);
      return flow && flow.expiresAt > now().getTime() ? flow : null;
    },
  };
}
