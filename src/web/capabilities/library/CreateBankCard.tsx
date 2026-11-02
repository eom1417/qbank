import { Alert, Button, Card, TextField, Title } from '../../design-system/index.js';
import { text, useSubmit } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { createBank } from './api.js';

export function CreateBankCard({ onCreated }: { onCreated(): void }) {
  const { t } = useI18n();
  const form = useSubmit(async (data) => {
    await createBank({
      name: text(data, 'name'),
      subject: text(data, 'subject'),
      description: text(data, 'description'),
    });
    onCreated();
  });
  const nameError = form.fieldErrors['name'];
  return (
    <Card>
      <Title>{t('library.create.title')}</Title>
      <form className="qb-stack" onSubmit={form.onSubmit} noValidate>
        {form.error && <Alert tone="error">{t(form.error)}</Alert>}
        <TextField
          name="name"
          required
          maxLength={120}
          label={t('library.field.name')}
          error={nameError && t(nameError)}
        />
        <TextField name="subject" maxLength={120} label={t('library.field.subject')} />
        <TextField name="description" maxLength={2000} label={t('library.field.description')} />
        <Button type="submit" busy={form.busy}>
          {t('library.create.submit')}
        </Button>
      </form>
    </Card>
  );
}
