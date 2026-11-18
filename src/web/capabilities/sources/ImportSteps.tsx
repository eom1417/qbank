import type { StepReport } from '../../../contracts/sources.js';
import { Badge, MutedText, Row, Spinner } from '../../design-system/index.js';
import { useI18n, type MessageKey } from '../../platform/i18n/i18n.js';

const STEPS = ['inspect', 'read', 'roles', 'link', 'check', 'assist', 'save'] as const;
const MARK = { done: '✓', failed: '✗', skipped: '–', running: '…', pending: '·' } as const;

function Progress({ report, label }: { report: StepReport; label: string }) {
  if (report.status === 'running') {
    return (
      <Row>
        <Spinner label={label} />
        {report.total > 0 && <MutedText>{`${report.done} / ${report.total}`}</MutedText>}
      </Row>
    );
  }
  return report.note ? <MutedText>{report.note}</MutedText> : null;
}

/** The seven detection steps and where each stands (M39 §5), on the import card and report. */
export function ImportSteps({ steps }: { steps: readonly StepReport[] }) {
  const { t } = useI18n();
  if (steps.length === 0) return null;
  return (
    <ul className="qb-list" aria-label={t('import.report.title')}>
      {STEPS.map((id) => {
        const report = steps.find((step) => step.step === id);
        const status = report?.status ?? 'pending';
        return (
          <li key={id} className="qb-list__item" data-status={status}>
            <Row>
              <Badge>{MARK[status]}</Badge>
              <span>{t(`import.step.${id}` as MessageKey)}</span>
              {report && <Progress report={report} label={t(`import.step.${id}` as MessageKey)} />}
            </Row>
          </li>
        );
      })}
    </ul>
  );
}
