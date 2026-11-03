import { useRef, useState } from 'react';
import {
  PROVIDER_PRESETS,
  type CreateProviderRequest,
  type ProviderPreset,
} from '../../../contracts/ai.js';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  MutedText,
  SelectField,
  TextField,
  Title,
} from '../../design-system/index.js';
import { numberOrNull, text, useSubmit } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { DisclosureNote } from './AiAboutCard.js';
import { createProvider } from './api.js';
import { ModelField } from './ModelField.js';

const DEFAULT_PRESET = PROVIDER_PRESETS[0] as ProviderPreset;

interface FieldErrorProps {
  fieldError(name: string): string | undefined;
}

/** Address and key of the chosen preset; only `custom` lets the user type an address. */
function connectionOf(preset: ProviderPreset, data: FormData) {
  const apiKey = text(data, 'apiKey').trim();
  return {
    kind: preset.kind,
    baseUrl: preset.baseUrl ?? text(data, 'baseUrl').trim(),
    ...(apiKey ? { apiKey } : {}),
  };
}

function toRequest(preset: ProviderPreset, data: FormData): CreateProviderRequest {
  return {
    ...connectionOf(preset, data),
    label: text(data, 'label'),
    model: text(data, 'model'),
    inputPrice: numberOrNull(data, 'inputPrice'),
    outputPrice: numberOrNull(data, 'outputPrice'),
    // The server rejects the request unless this box was really ticked (FR-20-003).
    acknowledgeDisclosure: (data.get('acknowledgeDisclosure') === 'on') as true,
  };
}

function KeyFields({ preset, fieldError }: FieldErrorProps & { preset: ProviderPreset }) {
  const { t } = useI18n();
  return (
    <>
      {preset.baseUrl ? (
        <MutedText>
          {t('ai.add.address')}: <bdi>{preset.baseUrl}</bdi>
        </MutedText>
      ) : (
        <TextField
          name="baseUrl"
          type="url"
          required
          dir="ltr"
          placeholder="https://"
          label={t('ai.add.baseUrl')}
          error={fieldError('baseUrl')}
        />
      )}
      <TextField
        name="apiKey"
        type="password"
        autoComplete="off"
        dir="ltr"
        label={t('ai.add.apiKey')}
        error={fieldError('apiKey')}
      />
      {preset.keysUrl && (
        <a href={preset.keysUrl} target="_blank" rel="noreferrer">
          {t('ai.add.getKey')}
        </a>
      )}
    </>
  );
}

function PriceAndConsent({ fieldError }: FieldErrorProps) {
  const { t } = useI18n();
  return (
    <>
      <TextField
        name="inputPrice"
        type="number"
        min={0}
        step="any"
        label={t('ai.add.inputPrice')}
      />
      <TextField
        name="outputPrice"
        type="number"
        min={0}
        step="any"
        label={t('ai.add.outputPrice')}
      />
      <DisclosureNote />
      <Checkbox
        name="acknowledgeDisclosure"
        label={t('ai.disclosure.ack')}
        error={fieldError('acknowledgeDisclosure')}
      />
    </>
  );
}

function useAddForm(preset: ProviderPreset, onAdded: () => void) {
  const { t } = useI18n();
  const formRef = useRef<HTMLFormElement>(null);
  const form = useSubmit(async (data) => {
    await createProvider(toRequest(preset, data));
    formRef.current?.reset();
    onAdded();
  });
  const fieldError = (name: string) => {
    const key = form.fieldErrors[name];
    return key && t(key);
  };
  const connection = () => connectionOf(preset, new FormData(formRef.current ?? undefined));
  return { form, formRef, fieldError, connection };
}

/** Connect your own AI (BYOK, UI-24): pick a provider, paste your key, choose a model. */
export function AddProviderCard({ onAdded }: { onAdded(): void }) {
  const { t } = useI18n();
  const [preset, setPreset] = useState<ProviderPreset>(DEFAULT_PRESET);
  const { form, formRef, fieldError, connection } = useAddForm(preset, onAdded);
  const presets = PROVIDER_PRESETS.map((p) => ({
    value: p.id,
    label: p.id === 'custom' ? t('ai.add.custom') : p.label,
  }));
  const choose = (id: string) =>
    setPreset(PROVIDER_PRESETS.find((p) => p.id === id) ?? DEFAULT_PRESET);
  return (
    <Card>
      <Title>{t('ai.add.title')}</Title>
      <form ref={formRef} className="qb-stack" onSubmit={form.onSubmit} noValidate>
        {form.error && <Alert tone="error">{t(form.error)}</Alert>}
        <SelectField
          name="preset"
          label={t('ai.add.kind')}
          options={presets}
          value={preset.id}
          onChange={(event) => choose(event.target.value)}
        />
        {/* Re-mounted per preset, so the suggested name and the model list start fresh. */}
        <div key={preset.id} className="qb-stack">
          <TextField
            name="label"
            required
            maxLength={80}
            defaultValue={preset.id === 'custom' ? '' : preset.label}
            label={t('ai.add.label')}
            error={fieldError('label')}
          />
          <KeyFields preset={preset} fieldError={fieldError} />
          <ModelField connection={connection} error={fieldError('model')} />
        </div>
        <PriceAndConsent fieldError={fieldError} />
        <Button type="submit" busy={form.busy}>
          {t('ai.add.submit')}
        </Button>
      </form>
    </Card>
  );
}
