import { useState } from 'react';
import type { SharePolicy } from '../../../contracts/sharing.js';
import type { Preset } from './presets.js';

type Section = 'content' | 'limits' | 'reveal' | 'records';

/** The share being set up: its name, its policy and the owner's rights confirmation. */
export function useShareDraft(preset: Preset) {
  const [name, setName] = useState('');
  const [policy, setPolicy] = useState<SharePolicy>(preset.policy);
  const [rights, setRights] = useState(false);
  const set = <S extends Section>(section: S, value: Partial<SharePolicy[S]>) =>
    setPolicy((p) => ({ ...p, [section]: { ...p[section], ...value } }));
  return {
    kind: preset.kind,
    name,
    setName,
    policy,
    setPolicy,
    set,
    rights,
    setRights,
  };
}

export type ShareDraft = ReturnType<typeof useShareDraft>;
