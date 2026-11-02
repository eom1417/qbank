import { useRef, useState } from 'react';
import type { CreateProviderRequest, ProviderKind } from '../../../contracts/ai.js';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  SelectField,
  TextField,
  Title,
} from '../../design-system/index.js';
import { numberOrNull, text, useSubmit } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { DisclosureNote } from './AiAboutCard.js';
import { createProvider } from './api.js';

interface Props {
  localAvailable: boolean;
  onAdded(): void;
}

function toRequest(kind: ProviderKind, data: FormData): CreateProviderRequest {
  const common = { label: text(data, 'label'), model: text(data, 'model') };
  if (kind === 'local') return { kind, ...common };
  const apiKey = text(data, 'apiKey').trim();
  return {
    kind,
    ...common,
    baseUrl: text(data, 'baseUrl'),
    ...(apiKey ? { apiKey } : {}),
    inputPrice: numberOrNull(data, 'inputPrice'),
    outputPrice: numberOrNull(data, 'outputPrice'),
    // The server rejects the request unless this box was really ticked (FR-20-003).
    acknowledgeDisclosure: (data.get('acknowledgeDisclosure') === 'on') as true,
  };
}

interface FieldErrorProps {
  fieldError(name: string): string | undefined;
}

function ExternalFields({ fieldError }: FieldErrorProps) {
  const { t } = useI18n();
  return (
    <>
      <TextField
        name="baseUrl"
        type="url"
        required
        dir="ltr"
        placeholder="https://"
        label={t('ai.add.baseUrl')}
        error={fieldError('baseUrl')}
      />
      <TextField
        name="apiKey"
        type="password"
        autoComplete="off"
        label={t('ai.add.apiKey')}
        error={fieldError('apiKey')}
      />
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
      <DisclosureNote kind="openai_compatible" />
      <Checkbox
        name="acknowledgeDisclosure"
        label={t('ai.disclosure.ack')}
        error={fieldError('acknowledgeDisclosure')}
      />
    </>
  );
}

function CommonFields({ fieldError }: FieldErrorProps) {
  const { t } = useI18n();
  return (
    <>
      <TextField
        name="label"
        required
        maxLength={80}
        label={t('ai.add.label')}
        error={fieldError('label')}
      />
      <TextField
        name="model"
        required
        dir="ltr"
        hint={t('ai.add.modelHint')}
        label={t('ai.model')}
        error={fieldError('model')}
      />
    </>
  );
}

/** Adds a connection: the local server (no key) or any OpenAI-compatible service (UI-24). */
export function AddProviderCard({ localAvailable, onAdded }: Props) {
  const { t } = useI18n();
  const formRef = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<ProviderKind>(localAvailable ? 'local' : 'openai_compatible');
  const form = useSubmit(async (data) => {
    await createProvider(toRequest(kind, data));
    formRef.current?.reset();
    onAdded();
  });
  const fieldError = (name: string) => {
    const key = form.fieldErrors[name];
    return key && t(key);
  };
  const kinds = (
    localAvailable ? (['local', 'openai_compatible'] as const) : (['openai_compatible'] as const)
  ).map((value) => ({ value, label: t(`ai.kind.${value}`) }));
  return (
    <Card>
      <Title>{t('ai.add.title')}</Title>
      <form ref={formRef} className="qb-stack" onSubmit={form.onSubmit} noValidate>
        {form.error && <Alert tone="error">{t(form.error)}</Alert>}
        <SelectField
          name="kind"
          label={t('ai.add.kind')}
          options={kinds}
          value={kind}
          onChange={(event) => setKind(event.target.value as ProviderKind)}
        />
        <CommonFields fieldError={fieldError} />
        {kind === 'local' ? (
          <DisclosureNote kind="local" />
        ) : (
          <ExternalFields fieldError={fieldError} />
        )}
        <Button type="submit" busy={form.busy}>
          {t('ai.add.submit')}
        </Button>
      </form>
    </Card>
  );
}
