import { useState } from 'react';
import type { ProviderResponse, TrialResponse } from '../../../contracts/ai.js';
import {
  Alert,
  Badge,
  Button,
  ConfirmButton,
  MutedText,
  Row,
  Stack,
  Subtitle,
} from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { deleteProvider, makeDefault, updateProvider } from './api.js';
import { KeyForm } from './KeyForm.js';
import { useProviderActions, type ProviderActions } from './use-provider-actions.js';

interface Props {
  provider: ProviderResponse;
  onChange(): void;
}

function ProviderDetails({ provider }: { provider: ProviderResponse }) {
  const { t, locale } = useI18n();
  const { readiness } = provider;
  const where = [t(`ai.kind.${provider.kind}`), provider.baseUrl, provider.account?.email]
    .filter(Boolean)
    .join(' · ');
  return (
    <>
      <Row>
        <Subtitle>{provider.label}</Subtitle>
        {provider.isDefault && <Badge>{t('ai.default')}</Badge>}
      </Row>
      <MutedText>
        {where} · {t('ai.model')}: <bdi>{provider.model}</bdi>
      </MutedText>
      {provider.account ? (
        <MutedText>
          {t('ai.account.plan')}: <bdi>{provider.account.plan ?? '—'}</bdi>
        </MutedText>
      ) : (
        <MutedText>
          {t('ai.key')}: <bdi>{provider.keyHint ?? t('ai.key.none')}</bdi>
        </MutedText>
      )}
      <Alert tone={readiness.status === 'ready' ? 'success' : 'info'}>
        {t(`ai.status.${readiness.status}`)}
        {readiness.checkedAt &&
          ` · ${t('ai.checkedAt')}: ${new Date(readiness.checkedAt).toLocaleString(locale)}`}
      </Alert>
    </>
  );
}

function TrialResult({ trial }: { trial: TrialResponse }) {
  const { t } = useI18n();
  if (trial.outcome === 'not_ready') return <Alert tone="error">{t('ai.trial.notReady')}</Alert>;
  if (!trial.question) return <Alert tone="error">{t('ai.trial.invalid')}</Alert>;
  return (
    <Alert tone="success">
      <Stack>
        <p>{t('ai.trial.ok')}</p>
        <p dir="auto">{trial.question.stem}</p>
        {/* Exactly what the model returned, after validation: no letters are added. */}
        <ul>
          {trial.question.options.map((option, index) => (
            <li key={index} dir="auto">
              {option}
            </li>
          ))}
        </ul>
        <p>
          {t('ai.trial.answer')}: <bdi>{trial.question.answer ?? '—'}</bdi>
        </p>
      </Stack>
    </Alert>
  );
}

interface ActionRowProps {
  provider: ProviderResponse;
  actions: ProviderActions;
  onChangeKey(): void;
}

function ActionRow({ provider, actions, onChangeKey }: ActionRowProps) {
  const { t } = useI18n();
  const { check, trial, change } = actions;
  const removeKey = () => updateProvider(provider.id, { apiKey: null });
  return (
    <Row>
      <Button variant="secondary" busy={check.busy} onClick={() => void check.run()}>
        {t('ai.check')}
      </Button>
      <Button variant="secondary" busy={trial.busy} onClick={() => void trial.run()}>
        {t('ai.trial')}
      </Button>
      {!provider.isDefault && (
        <Button variant="ghost" onClick={() => void change.run(() => makeDefault(provider.id))}>
          {t('ai.makeDefault')}
        </Button>
      )}
      {!provider.account && (
        <Button variant="ghost" onClick={onChangeKey}>
          {t('ai.changeKey')}
        </Button>
      )}
      {provider.keyHint && (
        <Button variant="ghost" onClick={() => void change.run(removeKey)}>
          {t('ai.removeKey')}
        </Button>
      )}
      <ConfirmButton
        label={t('ai.delete')}
        confirmLabel={t('ai.confirmDelete')}
        onConfirm={() => void change.run(() => deleteProvider(provider.id))}
      />
    </Row>
  );
}

function ResultNotice({ result }: { result: NonNullable<ProviderActions['result']> }) {
  const { t } = useI18n();
  if (result.kind === 'trial') return <TrialResult trial={result.trial} />;
  return result.fromCache ? <Alert tone="info">{t('ai.cached')}</Alert> : null;
}

/** One AI connection (UI-24): masked key, readiness, check, trial, default, key change, delete. */
export function ProviderItem({ provider, onChange }: Props) {
  const { t } = useI18n();
  const [changingKey, setChangingKey] = useState(false);
  const actions = useProviderActions({ provider, onChange });
  const { result } = actions;
  const error = actions.check.error ?? actions.trial.error ?? actions.change.error;
  const keyDone = (changed: boolean) => {
    setChangingKey(false);
    if (changed) onChange();
  };
  return (
    <Stack>
      <ProviderDetails provider={provider} />
      {error && <Alert tone="error">{t(error)}</Alert>}
      {result && <ResultNotice result={result} />}
      {changingKey ? (
        <KeyForm id={provider.id} onDone={keyDone} />
      ) : (
        <ActionRow provider={provider} actions={actions} onChangeKey={() => setChangingKey(true)} />
      )}
      {actions.trial.busy && <MutedText>{t('ai.trial.hint')}</MutedText>}
    </Stack>
  );
}
