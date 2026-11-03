import { useState } from 'react';
import type { AiSettings, EstimateResponse } from '../../../contracts/ai.js';
import {
  Alert,
  Button,
  Card,
  MutedText,
  Row,
  Stack,
  Subtitle,
  TextField,
  Title,
} from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { numberOrNull, text, useSubmit } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { estimateTask, fetchAiSettings, saveAiSettings } from './api.js';

function LimitsForm({ settings }: { settings: AiSettings }) {
  const { t } = useI18n();
  const [saved, setSaved] = useState(false);
  const form = useSubmit(async (data) => {
    setSaved(false);
    await saveAiSettings({
      costLimitUsd: numberOrNull(data, 'costLimitUsd'),
      approvalPages: Number(text(data, 'approvalPages')),
    });
    setSaved(true);
  });
  const outOfRange = (name: string) => (form.fieldErrors[name] ? t('field.outOfRange') : undefined);
  return (
    <form className="qb-stack" onSubmit={form.onSubmit} noValidate>
      {form.error && <Alert tone="error">{t(form.error)}</Alert>}
      {saved && <Alert tone="success">{t('settings.saved')}</Alert>}
      <TextField
        name="costLimitUsd"
        type="number"
        min={0}
        step="any"
        defaultValue={settings.costLimitUsd ?? ''}
        label={t('ai.limits.cost')}
        error={outOfRange('costLimitUsd')}
      />
      <TextField
        name="approvalPages"
        type="number"
        min={1}
        max={5000}
        defaultValue={settings.approvalPages}
        label={t('ai.limits.pages')}
        error={outOfRange('approvalPages')}
      />
      <Button type="submit" busy={form.busy}>
        {t('settings.save')}
      </Button>
    </form>
  );
}

function EstimateResult({ estimate }: { estimate: EstimateResponse }) {
  const { t } = useI18n();
  if (!estimate.provider) return <Alert tone="info">{t('ai.estimate.noProvider')}</Alert>;
  const cost = estimate.costUsd === null ? t('ai.estimate.unknown') : `$${estimate.costUsd}`;
  return (
    <Alert tone={estimate.needsApproval ? 'info' : 'success'}>
      <Stack>
        <p>
          {t('ai.estimate.provider')}: {estimate.provider.label}
        </p>
        <p>
          {t('ai.estimate.tokens')}: {estimate.inputTokens} / {estimate.outputTokens}
        </p>
        <p>
          {t('ai.estimate.cost')}: {cost}
        </p>
        <p>{t(estimate.needsApproval ? 'ai.estimate.approval' : 'ai.estimate.ok')}</p>
        {estimate.needsApproval && (
          <ul>
            {estimate.reasons.map((reason) => (
              <li key={reason}>{t(`ai.reason.${reason}`)}</li>
            ))}
          </ul>
        )}
      </Stack>
    </Alert>
  );
}

function EstimateForm() {
  const { t } = useI18n();
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const form = useSubmit(async (data) => {
    const imagePages = numberOrNull(data, 'imagePages') ?? 0;
    setEstimate(await estimateTask({ pages: Number(text(data, 'pages')), imagePages }));
  });
  return (
    <form className="qb-stack" onSubmit={form.onSubmit} noValidate>
      <Subtitle>{t('ai.estimate.title')}</Subtitle>
      {form.error && <Alert tone="error">{t(form.error)}</Alert>}
      <Row>
        <TextField
          name="pages"
          type="number"
          min={1}
          max={5000}
          defaultValue={300}
          label={t('ai.estimate.pages')}
        />
        <TextField
          name="imagePages"
          type="number"
          min={0}
          max={5000}
          defaultValue={0}
          label={t('ai.estimate.imagePages')}
        />
        <Button type="submit" variant="secondary" busy={form.busy}>
          {t('ai.estimate.submit')}
        </Button>
      </Row>
      {estimate && <EstimateResult estimate={estimate} />}
    </form>
  );
}

/** Spending limits and an honest estimate tool (FR-08-012, FR-22-008, DEC-18 provisional). */
export function AiLimitsCard() {
  const { t } = useI18n();
  const { state } = useQuery(fetchAiSettings);
  return (
    <Card>
      <Title>{t('ai.limits.title')}</Title>
      <MutedText>{t('ai.limits.intro')}</MutedText>
      {state.status === 'error' && <Alert tone="error">{t(state.error)}</Alert>}
      {state.status === 'ready' && <LimitsForm settings={state.data} />}
      <EstimateForm />
    </Card>
  );
}
