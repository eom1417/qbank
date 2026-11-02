import { useState } from 'react';
import type { ProviderResponse, TrialResponse } from '../../../contracts/ai.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { checkProvider, runTrial } from './api.js';

type Result = { kind: 'check'; fromCache: boolean } | { kind: 'trial'; trial: TrialResponse };

interface Props {
  provider: ProviderResponse;
  onChange(): void;
}

/** Check, trial and change actions of one connection, with the last result to show. */
export function useProviderActions({ provider, onChange }: Props) {
  const [result, setResult] = useState<Result | null>(null);
  const check = useAction(async () => {
    const response = await checkProvider(provider.id);
    setResult({ kind: 'check', fromCache: response.fromCache });
    onChange();
  });
  const trial = useAction(async () => {
    setResult({ kind: 'trial', trial: await runTrial(provider.id) });
    onChange();
  });
  const change = useAction(async (action: () => Promise<unknown>) => {
    setResult(null);
    await action();
    onChange();
  });
  return { result, check, trial, change };
}

export type ProviderActions = ReturnType<typeof useProviderActions>;
