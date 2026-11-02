import type { AiSettings, ApprovalReason } from '../../../../contracts/ai.js';

/**
 * Rough per-page token budget for reading a question page and returning structured questions.
 * These are planning numbers, not a bill: the UI always calls the result an estimate.
 */
const TOKENS = { textPageIn: 1500, imagePageIn: 1100, pageOut: 700 } as const;

interface Pricing {
  inputPrice: number | null;
  outputPrice: number | null;
}

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
}

export const DEFAULT_AI_SETTINGS: AiSettings = { costLimitUsd: null, approvalPages: 200 };

export function estimateCost(pages: number, imagePages: number, pricing: Pricing): CostEstimate {
  const inputTokens = pages * TOKENS.textPageIn + imagePages * TOKENS.imagePageIn;
  const outputTokens = pages * TOKENS.pageOut;
  const { inputPrice, outputPrice } = pricing;
  const costUsd =
    inputPrice === null || outputPrice === null
      ? null
      : Math.round(((inputTokens * inputPrice + outputTokens * outputPrice) / 1e6) * 10_000) /
        10_000;
  return { inputTokens, outputTokens, costUsd };
}

/** DEC-18 (provisional default): ask whenever the task passes a limit the user set. */
export function approvalReasons(
  pages: number,
  costUsd: number | null,
  settings: AiSettings,
): ApprovalReason[] {
  const reasons: ApprovalReason[] = [];
  if (pages > settings.approvalPages) reasons.push('over_page_limit');
  if (settings.costLimitUsd !== null) {
    if (costUsd === null) reasons.push('cost_unknown');
    else if (costUsd > settings.costLimitUsd) reasons.push('over_cost_limit');
  }
  return reasons;
}
