import { useState } from 'react';
import type { AccountDeletionResponse } from '../../../contracts/portability.js';
import {
  Alert,
  Card,
  ConfirmButton,
  MutedText,
  Stack,
  Subtitle,
} from '../../design-system/index.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { deleteAccount } from './api.js';

/** Deleting everything (UI-27, FR-19-006, FR-19-007): the scope said first, then each step's real result. */
export function AccountDeletionCard() {
  const { t } = useI18n();
  const [report, setReport] = useState<AccountDeletionResponse | null>(null);
  const run = useAction(async () => {
    const result = await deleteAccount();
    setReport(result);
    if (result.complete) window.location.assign('/');
  });
  return (
    <Card>
      <Stack>
        <Subtitle>{t('deleteAccount.title')}</Subtitle>
        <MutedText>{t('deleteAccount.lead')}</MutedText>
        <ConfirmButton
          label={t('deleteAccount.button')}
          confirmLabel={t('deleteAccount.confirm')}
          busy={run.busy}
          onConfirm={() => void run.run()}
        />
        {run.error && <Alert tone="error">{t(run.error)}</Alert>}
        {report?.steps.map((s) => (
          <MutedText key={s.step}>
            {t(`deleteAccount.step.${s.step}`)}:{' '}
            {t(s.done ? 'deleteAccount.done' : 'deleteAccount.notDone')}
          </MutedText>
        ))}
        {report && !report.complete && <Alert tone="error">{t('deleteAccount.incomplete')}</Alert>}
      </Stack>
    </Card>
  );
}
