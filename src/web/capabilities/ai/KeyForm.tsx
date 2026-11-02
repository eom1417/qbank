import { Button, TextField } from '../../design-system/index.js';
import { text, useSubmit } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { updateProvider } from './api.js';

interface KeyFormProps {
  id: string;
  onDone(changed: boolean): void;
}

/** Replaces a connection's key; the old one is overwritten, never shown. */
export function KeyForm({ id, onDone }: KeyFormProps) {
  const { t } = useI18n();
  const form = useSubmit(async (data) => {
    await updateProvider(id, { apiKey: text(data, 'apiKey') });
    onDone(true);
  });
  const error = form.fieldErrors['apiKey'];
  return (
    <form className="qb-row" onSubmit={form.onSubmit} noValidate>
      <TextField
        name="apiKey"
        type="password"
        autoComplete="off"
        required
        label={t('ai.newKey')}
        error={error && t(error)}
      />
      <Button type="submit" busy={form.busy}>
        {t('settings.save')}
      </Button>
      <Button variant="ghost" onClick={() => onDone(false)}>
        {t('bank.cancel')}
      </Button>
    </form>
  );
}
