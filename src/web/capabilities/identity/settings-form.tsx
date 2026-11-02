import { useState, type ReactNode } from 'react';
import type { UpdateAccountRequest } from '../../../contracts/identity.js';
import { Alert, Button, Card, Title } from '../../design-system/index.js';
import { useSubmit } from '../../platform/forms/use-submit.js';
import { useI18n, type MessageKey } from '../../platform/i18n/i18n.js';
import { useSession } from './session.js';

type FormState = ReturnType<typeof useSubmit> & { saved: boolean };

/** Submits a settings form and remembers that it was saved, so the card can say so honestly. */
export function useSavedForm(action: (form: FormData) => Promise<void>): FormState {
  const [saved, setSaved] = useState(false);
  const form = useSubmit(async (data) => {
    setSaved(false);
    await action(data);
    setSaved(true);
  });
  return { ...form, saved };
}

export function useAccountForm(toChanges: (form: FormData) => UpdateAccountRequest) {
  const { updateAccount } = useSession();
  return useSavedForm((data) => updateAccount(toChanges(data)));
}

interface SettingsFormProps {
  title: MessageKey;
  form: FormState;
  submitLabel?: MessageKey;
  savedMessage?: MessageKey;
  children: ReactNode;
}

/** One settings card: title, status line, fields and a submit button. */
export function SettingsForm({
  title,
  form,
  submitLabel,
  savedMessage,
  children,
}: SettingsFormProps) {
  const { t } = useI18n();
  const savedText = t(savedMessage ?? 'settings.saved');
  const submitText = t(submitLabel ?? 'settings.save');
  return (
    <Card>
      <Title>{t(title)}</Title>
      <form className="qb-stack" onSubmit={form.onSubmit} noValidate>
        {form.error && <Alert tone="error">{t(form.error)}</Alert>}
        {form.saved && <Alert tone="success">{savedText}</Alert>}
        {children}
        <Button type="submit" busy={form.busy}>
          {submitText}
        </Button>
      </form>
    </Card>
  );
}
