import { useCallback } from 'react';
import type { RestorePreviewResponse } from '../../../contracts/backup.js';
import { Alert, ConfirmButton, MutedText, Stack } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { previewRestore, restoreBackup } from './api.js';

type Summary = RestorePreviewResponse['now'];

function Counts({ label, counts }: { label: string; counts: Summary }) {
  const { t } = useI18n();
  return (
    <MutedText>
      {label}: {counts.banks} {t('backup.banks')} · {counts.questions} {t('backup.questions')} ·{' '}
      {counts.sessions} {t('backup.sessions')} · {counts.pictures} {t('backup.pictures')}
    </MutedText>
  );
}

/** What a restore brings back against what is here now, then two deliberate clicks. */
export function RestorePanel({ id }: { id: string }) {
  const { t } = useI18n();
  const { state } = useQuery(useCallback(() => previewRestore(id), [id]));
  // Everything on screen changed: a fresh load shows the restored install as it is.
  const restore = useAction(async () => {
    await restoreBackup(id);
    window.location.reload();
  });
  if (state.status === 'loading') return <MutedText>{t('common.loading')}</MutedText>;
  if (state.status === 'error') return <Alert tone="error">{t(state.error)}</Alert>;
  const preview = state.data;
  return (
    <Stack>
      <Counts label={t('backup.inBackup')} counts={preview.backup} />
      <Counts label={t('backup.now')} counts={preview.now} />
      {preview.compatible ? (
        <Alert tone="info">{t('backup.restoreWarning')}</Alert>
      ) : (
        <Alert tone="error">{t('error.backup_too_new')}</Alert>
      )}
      {restore.error && <Alert tone="error">{t(restore.error)}</Alert>}
      {preview.compatible && (
        <ConfirmButton
          label={t('backup.restore')}
          confirmLabel={t('backup.restore.confirm')}
          busy={restore.busy}
          onConfirm={() => void restore.run()}
        />
      )}
    </Stack>
  );
}
