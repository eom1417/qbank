import { useState } from 'react';
import { CopySettingsResponse } from '../../../contracts/backup.js';
import { Alert, Button, MutedText, Row, Stack, TextField } from '../../design-system/index.js';
import { apiRequest } from '../../platform/api/client.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';

const fetchCopy = () => apiRequest('GET', '/api/backups/copy', CopySettingsResponse);
const chooseFolder = (folder: string | null) =>
  apiRequest('PUT', '/api/backups/copy', CopySettingsResponse, { folder });

function Status({ copy }: { copy: CopySettingsResponse }) {
  const { t, locale } = useI18n();
  if (!copy.folder) return <MutedText>{t('backup.copy.none')}</MutedText>;
  if (copy.lastError)
    return (
      <Alert tone="error">
        {t('backup.copy.failed')} ({copy.lastError})
      </Alert>
    );
  const when = copy.lastCopyAt
    ? new Date(copy.lastCopyAt).toLocaleString(locale)
    : t('health.never');
  return (
    <MutedText>
      {t('backup.copy.last')} <bdi>{when}</bdi>
    </MutedText>
  );
}

/** A folder a cloud app syncs (off this computer's QBank data) that receives every backup. */
export function CopyFolderForm() {
  const { t } = useI18n();
  const { state, reload } = useQuery(fetchCopy);
  const [folder, setFolder] = useState<string | null>(null);
  const save = useAction(async (next: string | null) => {
    await chooseFolder(next);
    setFolder(null);
    reload();
  });
  if (state.status !== 'ready') return null;
  const copy = state.data;
  const problem = save.fieldErrors['folder'];
  return (
    <Stack>
      <TextField
        label={t('backup.copy.label')}
        hint={t('backup.copy.hint')}
        value={folder ?? copy.folder ?? ''}
        onChange={(event) => setFolder(event.target.value)}
        error={problem && t(problem)}
      />
      <Row>
        <Button
          variant="secondary"
          busy={save.busy}
          disabled={!(folder ?? '').trim()}
          onClick={() => void save.run((folder ?? '').trim())}
        >
          {t('backup.copy.save')}
        </Button>
        {copy.folder && (
          <Button variant="ghost" onClick={() => void save.run(null)}>
            {t('backup.copy.stop')}
          </Button>
        )}
      </Row>
      <Status copy={copy} />
    </Stack>
  );
}
