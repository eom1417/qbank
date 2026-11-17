import { describe, expect, it } from 'vitest';
import {
  approvedModels,
  modelFor,
} from '../../../src/server/capabilities/sources/domain/pipeline/approved-models.js';

describe('approved models per lesson (M34 P3)', () => {
  it('approves the light and strong Claude models for the vision lessons', () => {
    expect(modelFor('D4.mark', 'claude', 'light')).toBe('claude-haiku-5-5');
    expect(modelFor('D4.mark', 'claude', 'strong')).toBe('claude-opus-5-5');
    expect(modelFor('D1.2', 'claude', 'light')).toBe('claude-haiku-5-5');
  });

  it('approves nothing unmeasured: Codex and unknown lessons go to review', () => {
    expect(approvedModels('D4.mark', 'codex')).toEqual({ light: [], strong: [] });
    expect(modelFor('D4.mark', 'codex', 'light')).toBeNull();
    expect(modelFor('D9.unknown', 'claude', 'strong')).toBeNull();
  });
});
