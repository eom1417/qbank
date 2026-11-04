import { useCallback } from 'react';
import {
  Alert,
  Card,
  ConfirmButton,
  MutedText,
  Stack,
  Subtitle,
} from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { deleteQuestion, fetchDeletionImpact } from './api.js';

/**
 * Deleting for good, apart from hiding (FR-09-007): what goes with it is counted first, and it
 * takes two deliberate clicks.
 */
export function DeleteCard({ questionId, onDeleted }: { questionId: string; onDeleted(): void }) {
  const { t } = useI18n();
  const load = useCallback(() => fetchDeletionImpact(questionId), [questionId]);
  const { state } = useQuery(load);
  const remove = useAction(async () => {
    await deleteQuestion(questionId);
    onDeleted();
  });
  return (
    <Card>
      <Stack>
        <Subtitle>{t('editor.delete')}</Subtitle>
        <MutedText>{t('editor.delete.lead')}</MutedText>
        {state.status === 'ready' && (
          <MutedText>
            {t('editor.delete.impact')} {state.data.versions} {t('editor.delete.versions')} ·{' '}
            {state.data.pictures} {t('editor.delete.pictures')} · {state.data.notes}{' '}
            {t('editor.delete.notes')} · {state.data.reports} {t('editor.delete.reports')}
          </MutedText>
        )}
        {remove.error && <Alert tone="error">{t(remove.error)}</Alert>}
        <ConfirmButton
          label={t('editor.delete')}
          confirmLabel={t('editor.delete.confirm')}
          busy={remove.busy}
          onConfirm={() => void remove.run()}
        />
      </Stack>
    </Card>
  );
}
