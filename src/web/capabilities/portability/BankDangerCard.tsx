import { useCallback } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Alert,
  buttonClass,
  Card,
  ConfirmButton,
  MutedText,
  Row,
  Stack,
  Subtitle,
} from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { deleteBank, fetchDeletionImpact } from './api.js';

/** Export and deletion of one bank (UI-27, FR-19-005, FR-02-007): the impact first, then two clicks. */
export function BankDangerCard({ bankId }: { bankId: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { state } = useQuery(useCallback(() => fetchDeletionImpact(bankId), [bankId]));
  const remove = useAction(async () => {
    await deleteBank(bankId);
    void navigate('/');
  });
  return (
    <Card>
      <Stack>
        <Link className={buttonClass('secondary')} to={`/banks/${bankId}/export`}>
          {t('export.link')}
        </Link>
        <Subtitle>{t('deleteBank.title')}</Subtitle>
        <MutedText>{t('deleteBank.lead')}</MutedText>
        {state.status === 'ready' && (
          <MutedText>
            {t('deleteBank.impact')} {state.data.questions} {t('export.questions')} ·{' '}
            {state.data.pictures} {t('export.pictures')} · {state.data.sources}{' '}
            {t('export.sources')} · {state.data.notes} {t('export.notes')} · {state.data.sessions}{' '}
            {t('deleteBank.sessions')} ({state.data.activeSessions} {t('deleteBank.active')})
          </MutedText>
        )}
        {remove.error && <Alert tone="error">{t(remove.error)}</Alert>}
        <Row>
          <ConfirmButton
            label={t('deleteBank.button')}
            confirmLabel={t('deleteBank.confirm')}
            busy={remove.busy}
            onConfirm={() => void remove.run()}
          />
        </Row>
      </Stack>
    </Card>
  );
}
