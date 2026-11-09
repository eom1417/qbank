import { Alert } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

const SAVE_TEXT = { saving: 'exam.saving', saved: 'exam.saved', failed: 'exam.notSaved' } as const;

/** Whether the last choice reached the server: never claims a save it did not confirm. */
export function SaveState({ status }: { status: SaveStatus }) {
  const { t } = useI18n();
  if (status === 'idle') return null;
  return status === 'failed' ? (
    <Alert tone="error">{t(SAVE_TEXT.failed)}</Alert>
  ) : (
    <Alert tone="info">{t(SAVE_TEXT[status])}</Alert>
  );
}
