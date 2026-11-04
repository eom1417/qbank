import { useState } from 'react';
import type { BackupListResponse } from '../../../contracts/backup.js';
import { Alert, Button, Card, MutedText, Row, Stack, Subtitle } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { useSession } from '../identity/session.js';
import { backUpNow, fetchBackups } from './api.js';
import { RestorePanel } from './RestorePanel.js';

type Backup = BackupListResponse['backups'][number];

const megabytes = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

function BackupRow({ backup, open, onOpen }: { backup: Backup; open: boolean; onOpen(): void }) {
  const { t, locale } = useI18n();
  const when = new Date(backup.createdAt).toLocaleString(locale);
  return (
    <Stack>
      <Row>
        <MutedText>
          <bdi>{when}</bdi> · {t(`backup.reason.${backup.reason}`)} · {backup.questions}{' '}
          {t('backup.questions')} · {megabytes(backup.sizeBytes)} MB
        </MutedText>
        <Button variant="ghost" onClick={onOpen}>
          {t(open ? 'backup.close' : 'backup.open')}
        </Button>
      </Row>
      {open && <RestorePanel id={backup.id} />}
    </Stack>
  );
}

/** Full local backups (M17.2), local mode only: list, back up now, restore with a preview. */
export function BackupCard() {
  const { mode } = useSession();
  return mode === 'local' ? <Backups /> : null;
}

function Backups() {
  const { t } = useI18n();
  const { state, reload } = useQuery(fetchBackups);
  const [open, setOpen] = useState<string | null>(null);
  const now = useAction(async () => {
    await backUpNow();
    reload();
  });
  const backups = state.status === 'ready' ? state.data.backups : [];
  return (
    <Card>
      <Stack>
        <Subtitle>{t('backup.title')}</Subtitle>
        <MutedText>{t('backup.lead')}</MutedText>
        <Button variant="secondary" busy={now.busy} onClick={() => void now.run()}>
          {t('backup.now.make')}
        </Button>
        {now.error && <Alert tone="error">{t(now.error)}</Alert>}
        {state.status === 'ready' && backups.length === 0 && (
          <MutedText>{t('backup.none')}</MutedText>
        )}
        {backups.map((backup) => (
          <BackupRow
            key={backup.id}
            backup={backup}
            open={open === backup.id}
            onOpen={() => setOpen(open === backup.id ? null : backup.id)}
          />
        ))}
      </Stack>
    </Card>
  );
}
