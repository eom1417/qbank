import { useState, type FormEvent } from 'react';
import type { ShareSecretResponse } from '../../../contracts/sharing.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { createShare } from './api.js';
import { issueFields } from './presets.js';
import type { ShareDraft } from './use-share-draft.js';

/**
 * Publishing a draft: the contract's rules first (friendly errors on their fields, the
 * advanced rules opened, focus on the first one), the rights confirmation, then the server,
 * which checks everything again.
 */
export function useSharePublish(
  bankId: string,
  draft: ShareDraft,
  onCreated: (created: ShareSecretResponse) => void,
) {
  const { t } = useI18n();
  const [advanced, setAdvanced] = useState(false);
  const [tried, setTried] = useState(false);
  const issues = issueFields(draft.kind, draft.policy);
  const blocked = Object.keys(issues).length > 0;
  const errors: Record<string, string> = tried
    ? Object.fromEntries(Object.entries(issues).map(([field, key]) => [field, t(key)]))
    : {};
  const publish = useAction(async () => {
    const { kind, name, policy } = draft;
    onCreated(await createShare(bankId, { kind, name, policy, rightsConfirmed: true }));
  });
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setTried(true);
    if (blocked) setAdvanced(true);
    if (!blocked && draft.rights) return void publish.run();
    requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  };
  return {
    onSubmit,
    errors,
    advanced,
    toggleAdvanced: () => setAdvanced((open) => !open),
    rightsMissing: tried && !draft.rights,
    showFix: tried && blocked,
    publish,
  };
}
