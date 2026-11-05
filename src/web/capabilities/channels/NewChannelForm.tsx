import { useCallback, useState } from 'react';
import type { ChannelSettings } from '../../../contracts/channels.js';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  SelectField,
  Stack,
  TextField,
  Title,
} from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useSubmit } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchTaxonomy } from '../library/taxonomy-api.js';
import { createChannel } from './api.js';

const SIZES = Array.from({ length: 10 }, (_, i) => String(i + 1));

/** The bank's chapters to choose from; none chosen means the whole bank. */
function ChapterChoice({ bankId }: { bankId: string }) {
  const { t } = useI18n();
  const { state } = useQuery(useCallback(() => fetchTaxonomy(bankId), [bankId]));
  if (state.status !== 'ready' || state.data.chapters.length === 0) return null;
  return (
    <fieldset>
      <legend>{t('channels.chapters')}</legend>
      {state.data.chapters.map((chapter) => (
        <Checkbox key={chapter.id} name="chapterIds" value={chapter.id} label={chapter.name} />
      ))}
    </fieldset>
  );
}

const settingsOf = (form: FormData): ChannelSettings => ({
  name: String(form.get('name') ?? ''),
  chapterIds: form.getAll('chapterIds').map(String),
  batchSize: Number(form.get('batchSize')),
  whenDone: form.get('whenDone') === 'stop' ? 'stop' : 'restart',
});

/** A new channel on the bank; its key goes to `onCreated`, to be shown once. */
export function NewChannelForm(props: { bankId: string; onCreated(key: string): void }) {
  const { t } = useI18n();
  const [formKey, setFormKey] = useState(0);
  const submit = useSubmit(async (form) => {
    const created = await createChannel(props.bankId, settingsOf(form));
    setFormKey((n) => n + 1);
    props.onCreated(created.key);
  });
  return (
    <Card>
      <form key={formKey} onSubmit={submit.onSubmit}>
        <Stack>
          <Title>{t('channels.new')}</Title>
          <TextField label={t('channels.name')} name="name" required maxLength={100} />
          <ChapterChoice bankId={props.bankId} />
          <SelectField
            label={t('channels.batchSize')}
            name="batchSize"
            defaultValue="3"
            options={SIZES.map((size) => ({ value: size, label: size }))}
          />
          <SelectField
            label={t('channels.whenDone')}
            name="whenDone"
            options={[
              { value: 'restart', label: t('channels.whenDone.restart') },
              { value: 'stop', label: t('channels.whenDone.stop') },
            ]}
          />
          {submit.error && <Alert tone="error">{t(submit.error)}</Alert>}
          <Button type="submit" busy={submit.busy}>
            {t('channels.create')}
          </Button>
        </Stack>
      </form>
    </Card>
  );
}
