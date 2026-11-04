import type { HealthResponse } from '../../../contracts/health.js';
import { Alert, Card, CodeText, MutedText, Stack, Subtitle } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchHealth } from './api.js';

const GB = 1024 * 1024 * 1024;

/** One line per part: a symbol and words (never colour alone), then the detail. */
function Line({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  const { t } = useI18n();
  return (
    <MutedText>
      <span aria-hidden="true">{ok ? '✓' : '!'}</span> {label}: {detail} ·{' '}
      {t(ok ? 'health.ok' : 'health.attention')}
    </MutedText>
  );
}

function Lines({ health }: { health: HealthResponse }) {
  const { t, locale } = useI18n();
  const when = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(locale) : t('health.never');
  const failed = health.lastFailedImport;
  return (
    <Stack>
      <Line
        ok={health.aiHost !== 'unreachable'}
        label={t('health.ai')}
        detail={
          health.aiHost === 'reachable'
            ? `${health.aiReady} ${t('health.ai.ready')}`
            : t(`health.ai.${health.aiHost}`)
        }
      />
      {health.diskFreeBytes !== null && (
        <Line
          ok={!health.problems.includes('disk_low')}
          label={t('health.disk')}
          detail={`${(health.diskFreeBytes / GB).toFixed(1)} GB ${t('health.disk.free')}`}
        />
      )}
      {health.backups && (
        <Line
          ok={!health.problems.includes('backup_old')}
          label={t('health.backup')}
          detail={when(health.lastBackupAt)}
        />
      )}
      <Line
        ok={failed === null}
        label={t('health.imports')}
        detail={
          failed
            ? `${t(`health.imports.${failed.stage === 'failed' ? 'failed' : 'partial'}`)} ${failed.fileName}`
            : t('health.imports.fine')
        }
      />
    </Stack>
  );
}

/** System health (M17.3): what works, what needs attention, and where the log is. In-app only. */
export function HealthCard() {
  const { t } = useI18n();
  const { state } = useQuery(fetchHealth);
  if (state.status !== 'ready') return null;
  const health = state.data;
  return (
    <Card>
      <Stack>
        <Subtitle>{t('health.title')}</Subtitle>
        {health.problems.length === 0 ? (
          <Alert tone="success">{t('health.allGood')}</Alert>
        ) : (
          health.problems.map((problem) => (
            <Alert key={problem} tone="info">
              {t(`health.problem.${problem}`)}
            </Alert>
          ))
        )}
        <Lines health={health} />
        {health.logFile && (
          <>
            <MutedText>{t('health.log')}</MutedText>
            <CodeText>{health.logFile}</CodeText>
          </>
        )}
      </Stack>
    </Card>
  );
}
