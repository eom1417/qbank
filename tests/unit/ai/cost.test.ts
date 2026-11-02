import { describe, expect, it } from 'vitest';
import { approvalReasons, estimateCost } from '../../../src/server/capabilities/ai/domain/cost.js';

describe('cost estimate (FR-08-012)', () => {
  it('estimates tokens per page and prices them only when both prices are known', () => {
    const priced = estimateCost(10, 4, { inputPrice: 2, outputPrice: 8 });
    expect(priced).toEqual({ inputTokens: 19_400, outputTokens: 7_000, costUsd: 0.0948 });
    expect(estimateCost(10, 0, { inputPrice: 2, outputPrice: null }).costUsd).toBeNull();
    expect(estimateCost(10, 0, { inputPrice: 0, outputPrice: 0 }).costUsd).toBe(0);
  });
});

describe('approval (FR-22-008, DEC-18 provisional)', () => {
  const settings = { costLimitUsd: 1, approvalPages: 100 };

  it('needs nothing under both limits', () => {
    expect(approvalReasons(100, 1, settings)).toEqual([]);
  });

  it('asks above the page limit or the cost limit', () => {
    expect(approvalReasons(101, 0.5, settings)).toEqual(['over_page_limit']);
    expect(approvalReasons(10, 1.01, settings)).toEqual(['over_cost_limit']);
  });

  it('asks when a money limit is set but the cost cannot be known', () => {
    expect(approvalReasons(10, null, settings)).toEqual(['cost_unknown']);
    expect(approvalReasons(10, null, { ...settings, costLimitUsd: null })).toEqual([]);
  });
});
