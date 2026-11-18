import type { DetectionIssue } from '../../../contracts/detection.js';
import { Alert, MutedText } from '../../design-system/index.js';
import { en } from '../../platform/i18n/catalog-en.js';
import { useI18n, type MessageKey } from '../../platform/i18n/i18n.js';

const span = (values: readonly number[]) =>
  values.length < 2 ? values.join(', ') : `${Math.min(...values)}–${Math.max(...values)}`;

/** Remaining source defects are visible even for an import that used no AI. */
export function DetectionIssues({ issues }: { issues: readonly DetectionIssue[] }) {
  const { t } = useI18n();
  if (issues.length === 0) return null;
  return (
    <Alert tone="info">
      {t('import.report.detectionIssues')}: {issues.length}
      <ul className="qb-list">
        {issues.map((issue, index) => {
          const key = `import.check.${issue.check}`;
          return (
            <li key={index} className="qb-list__item">
              {key in en ? t(key as MessageKey) : issue.check}
              <MutedText>
                {t('import.report.page')} <bdi>{span(issue.pages)}</bdi> ·{' '}
                {t('import.report.lines')} <bdi>{span(issue.lines)}</bdi>
              </MutedText>
              <MutedText>{issue.detail}</MutedText>
            </li>
          );
        })}
      </ul>
    </Alert>
  );
}
