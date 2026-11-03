import { useState } from 'react';
import type { ListModelsRequest, ReadinessStatus } from '../../../contracts/ai.js';
import { Alert, Button, Row, SelectField, TextField } from '../../design-system/index.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { listModels } from './api.js';

interface Props {
  /** Reads the address and key currently typed in the form. */
  connection(): ListModelsRequest;
  error: string | undefined;
}

/**
 * The model to use: typed by hand, or picked from the models the key may use. Loading the
 * list checks the key on the spot; the key is not saved by doing so.
 */
export function ModelField({ connection, error }: Props) {
  const { t } = useI18n();
  const [models, setModels] = useState<string[] | null>(null);
  const [status, setStatus] = useState<ReadinessStatus | null>(null);
  const load = useAction(async () => {
    const listing = await listModels(connection());
    setStatus(listing.status);
    setModels(listing.status === 'ready' && listing.models.length > 0 ? listing.models : null);
  });
  const options = (models ?? []).map((model) => ({ value: model, label: model }));
  return (
    <>
      {models ? (
        <SelectField name="model" label={t('ai.model')} options={options} />
      ) : (
        <TextField
          name="model"
          required
          dir="ltr"
          hint={t('ai.add.modelHint')}
          label={t('ai.model')}
          error={error}
        />
      )}
      <Row>
        <Button variant="secondary" busy={load.busy} onClick={() => void load.run()}>
          {t('ai.add.loadModels')}
        </Button>
      </Row>
      {load.error && <Alert tone="error">{t(load.error)}</Alert>}
      {status && status !== 'ready' && <Alert tone="error">{t(`ai.status.${status}`)}</Alert>}
      {models && <Alert tone="success">{t('ai.add.modelsLoaded')}</Alert>}
    </>
  );
}
