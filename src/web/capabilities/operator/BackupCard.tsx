import type { ServerStatusResponse } from '../../../contracts/operator.js';
import { Alert, Badge, MutedText, Row } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fill } from '../../platform/i18n/fill.js';
import { fetchStatus } from './api.js';
import { OperatorCard, useWhen } from './OperatorCard.js';
import { backupHealth } from './view.js';

type Backup = NonNullable<ServerStatusResponse['backup']>;

/** The last run: when, whether it worked, and how many copies the server keeps. */
function LastBackup({ backup, late }: { backup: Backup; late: boolean }) {
  const { t } = useI18n();
  const when = useWhen();
  return (
    <>
      <Row>
        <span className="qb-grow">
          {fill(t('operator.backup.last'), { when: when(backup.at) })}
        </span>
        <Badge>{t(backup.ok ? 'operator.backup.ok' : 'operator.backup.failedBadge')}</Badge>
      </Row>
      <MutedText>{fill(t('operator.backup.kept'), { n: backup.kept })}</MutedText>
      {!backup.ok && <Alert tone="error">{t('operator.backup.failed')}</Alert>}
      {late && <Alert tone="error">{t('operator.backup.late')}</Alert>}
    </>
  );
}

/** «Backups» (M32): the daily backup service's last run, with a warning when it is missing. */
export function BackupCard() {
  const { t } = useI18n();
  const { state, reload } = useQuery(fetchStatus);
  return (
    <OperatorCard title={t('operator.backup.title')} state={state} onRefresh={reload}>
      {({ backup }) => {
        if (!backup) return <Alert tone="error">{t('operator.backup.none')}</Alert>;
        const late = backupHealth(backup, new Date()) === 'late';
        return <LastBackup backup={backup} late={late} />;
      }}
    </OperatorCard>
  );
}
