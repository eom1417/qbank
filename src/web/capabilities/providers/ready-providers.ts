import { useState } from 'react';
import type { AiTarget, ProviderView } from '../../../contracts/providers.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { peekProviderState } from './api.js';

/** Which AI task a choice is remembered for (each keeps its own last choice). */
export type AiTask = 'import' | 'fix' | 'explain';

const SEPARATOR = '|';
const choiceKey = (instanceId: string, model?: string) =>
  model ? `${instanceId}${SEPARATOR}${model}` : instanceId;

/** The instance and model a choice stands for; none for the empty choice. */
export function targetOfChoice(choice: string): AiTarget | null {
  if (!choice) return null;
  const [instanceId = '', model] = choice.split(SEPARATOR);
  return model ? { instanceId, model } : { instanceId };
}

/** The instance's default first, then each model it offers now, as "Provider · Model". */
function choicesOf(provider: ProviderView, defaultLabel: string) {
  const name = provider.displayName ?? provider.driver;
  const fallback = provider.models.find((m) => m.isDefault)?.name;
  return [
    {
      value: choiceKey(provider.instanceId),
      label: `${name} · ${defaultLabel}${fallback ? ` (${fallback})` : ''}`,
    },
    ...provider.models.map((m) => ({
      value: choiceKey(provider.instanceId, m.slug),
      label: `${name} · ${m.name ?? m.slug}`,
    })),
  ];
}

/**
 * Every AI the user can run a task on now: each provider instance that is on and signed in, with
 * its models. Shared by every screen that lets the user pick their AI.
 */
export function useAiChoices() {
  const { t } = useI18n();
  const { state } = useQuery(peekProviderState);
  if (state.status !== 'ready') return [];
  return state.data.providers
    .filter((p) => p.enabled && p.auth.status === 'authenticated')
    .flatMap((p) => choicesOf(p, t('ai.model.default')));
}

const storageKey = (task: AiTask) => `qb.ai.${task}`;

/**
 * The choice for one task, kept on this browser: the last one used while it is still on offer,
 * otherwise `fallback` (the first choice, or none for an optional task).
 */
export function useRememberedChoice(
  task: AiTask,
  choices: readonly { value: string }[],
  fallback: string,
) {
  const [stored, setStored] = useState(() => localStorage.getItem(storageKey(task)) ?? '');
  const offered = choices.some((c) => c.value === stored);
  const choose = (value: string) => {
    localStorage.setItem(storageKey(task), value);
    setStored(value);
  };
  return [offered ? stored : fallback, choose] as const;
}
