import { useCallback } from 'react';
import { Badge, Button, Card, MutedText, Row, Stack, Subtitle } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchReports, resolveReport } from './api.js';

/** Reports raised while studying (FR-09-010): they ask for a look and change nothing alone. */
export function ReportsCard({ questionId }: { questionId: string }) {
  const { t, locale } = useI18n();
  const load = useCallback(() => fetchReports(questionId), [questionId]);
  const { state, reload } = useQuery(load);
  const resolve = useAction(async (id: string) => {
    await resolveReport(id);
    reload();
  });
  if (state.status !== 'ready' || state.data.reports.length === 0) return null;
  return (
    <Card>
      <Stack>
        <Subtitle>{t('editor.reports')}</Subtitle>
        {state.data.reports.map((report) => (
          <Row key={report.id}>
            <Badge>{t(`editor.report.${report.kind}`)}</Badge>
            {report.comment && <p dir="auto">{report.comment}</p>}
            <MutedText>{new Date(report.createdAt).toLocaleString(locale)}</MutedText>
            {report.resolved ? (
              <MutedText>{t('editor.reports.resolved')}</MutedText>
            ) : (
              <Button
                variant="secondary"
                busy={resolve.busy}
                onClick={() => void resolve.run(report.id)}
              >
                {t('editor.reports.resolve')}
              </Button>
            )}
          </Row>
        ))}
      </Stack>
    </Card>
  );
}
