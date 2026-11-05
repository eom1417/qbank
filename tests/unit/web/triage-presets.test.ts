import { describe, expect, it } from 'vitest';
import { presetModels } from '../../../src/web/capabilities/providers/triage-presets.js';

const CLAUDE = [
  'claude-opus-5-5',
  'claude-sonnet-5-5',
  'claude-fable-5-1',
  'claude-opus-4-8',
  'claude-haiku-5-5',
  'claude-haiku-4-5',
];

describe('triage presets (DEC-33)', () => {
  it('gives balanced two different solvers and a stronger judge, newest of each family', () => {
    expect(presetModels('balanced', CLAUDE)).toEqual({
      first: 'claude-sonnet-5-5',
      second: 'claude-haiku-5-5',
      judge: 'claude-opus-5-5',
      improver: 'claude-haiku-5-5',
    });
  });

  it('scales the models with the quality', () => {
    expect(presetModels('high', CLAUDE).first).toBe('claude-opus-5-5');
    expect(presetModels('economy', CLAUDE).judge).toBe('claude-sonnet-5-5');
  });

  it('leaves roles on the default model for a provider with unknown families', () => {
    expect(presetModels('balanced', ['gpt-6.1-sol', 'gpt-6-luna'])).toEqual({});
  });
});
