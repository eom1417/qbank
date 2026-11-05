import { useState } from 'react';
import type { ProviderView } from '../../../contracts/providers.js';
import type { TriageModels } from '../../../contracts/sources.js';
import { useQuery } from '../../platform/api/use-query.js';
import { fetchProviderState } from './api.js';
import { presetModels, type TriageQuality } from './triage-presets.js';

/** What the owner chose for the AI triage of an import or a re-check (DEC-33, DEC-04). */
export interface TriageChoice {
  /** The provider instance; empty means no AI. */
  instanceId: string;
  quality: TriageQuality;
  /** The models per role when the quality is `custom`. */
  custom: TriageModels;
  improve: boolean;
}

/** The AI a request runs on: instance, models per role, improvement mode. */
export interface TriageRequest {
  instanceId: string;
  improve: boolean;
  models: TriageModels;
}

const STORAGE_KEY = 'qb.ai.triage';
const FIRST_USE: TriageChoice = { instanceId: '', quality: 'balanced', custom: {}, improve: true };

function stored(): TriageChoice {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as TriageChoice | null;
    return value ? { ...FIRST_USE, ...value } : FIRST_USE;
  } catch {
    return FIRST_USE;
  }
}

/** The models of each role for a choice, on the instance's current models. */
export function modelsOf(choice: TriageChoice, provider: ProviderView | undefined): TriageModels {
  if (choice.quality === 'custom') return choice.custom;
  return presetModels(choice.quality, provider?.models.map((model) => model.slug) ?? []);
}

/**
 * The triage choice, kept on this browser, over the AI the owner can run now (each instance
 * that is on and signed in). A remembered instance no longer offered falls back to none.
 */
export function useTriageChoice() {
  const { state } = useQuery(fetchProviderState);
  const ready =
    state.status === 'ready'
      ? state.data.providers.filter((p) => p.enabled && p.auth.status === 'authenticated')
      : [];
  const [choice, setChoice] = useState(stored);
  const provider = ready.find((p) => p.instanceId === choice.instanceId);
  const current = provider ? choice : { ...choice, instanceId: '' };
  const change = (next: Partial<TriageChoice>) => {
    const value = { ...current, ...next };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    setChoice(value);
  };
  const request: TriageRequest | null = provider
    ? {
        instanceId: provider.instanceId,
        improve: current.improve,
        models: modelsOf(current, provider),
      }
    : null;
  return { choice: current, change, providers: ready, provider, request };
}

export type TriageChoiceState = ReturnType<typeof useTriageChoice>;
