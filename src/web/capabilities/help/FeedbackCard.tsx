import { useState } from 'react';
import { SupportReportResponse } from '../../../contracts/portability.js';
import {
  Button,
  Card,
  Checkbox,
  MutedText,
  SelectField,
  Stack,
  Subtitle,
  TextArea,
} from '../../design-system/index.js';
import { apiRequest } from '../../platform/api/client.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';

/** Where feedback goes: the project's issues on GitHub (a fork changes this one line). */
const NEW_ISSUE = 'https://github.com/eom1417/qbank/issues/new';
const KINDS = ['problem', 'reading', 'idea'] as const;
type Kind = (typeof KINDS)[number];

/** The issue as the owner will see it before sending: their words, then the report (no content). */
export function feedbackUrl(kind: Kind, tried: string, happened: string, report: unknown) {
  const title = `[${kind}] ${tried.trim().split('\n')[0]?.slice(0, 80) ?? ''}`;
  const parts = [`**What I tried / ماذا حاولت**\n${tried.trim()}`];
  if (happened.trim()) parts.push(`**What happened / ماذا حدث**\n${happened.trim()}`);
  if (report)
    parts.push(
      `**System report (counts and versions only)**\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\``,
    );
  const query = new URLSearchParams({ title, body: parts.join('\n\n') });
  return `${NEW_ISSUE}?${query.toString()}`;
}

/**
 * «Send feedback» in two fields (M28.2): it opens a new GitHub issue filled in with them and, if
 * the owner keeps it ticked, the support report. Nothing is sent from here: the owner reads it on
 * GitHub and submits it there. No question text or file ever goes into it.
 */
export function FeedbackCard() {
  const { t } = useI18n();
  const [kind, setKind] = useState<Kind>('problem');
  const [tried, setTried] = useState('');
  const [happened, setHappened] = useState('');
  const [withReport, setWithReport] = useState(true);
  const open = useAction(async () => {
    const report = withReport
      ? await apiRequest('GET', '/api/support/report', SupportReportResponse)
      : null;
    window.open(feedbackUrl(kind, tried, happened, report), '_blank', 'noopener');
  });
  return (
    <Card>
      <Stack>
        <Subtitle>{t('feedback.title')}</Subtitle>
        <MutedText>{t('feedback.lead')}</MutedText>
        <SelectField
          label={t('feedback.kind')}
          value={kind}
          onChange={(event) => setKind(event.target.value as Kind)}
          options={KINDS.map((value) => ({ value, label: t(`feedback.kind.${value}`) }))}
        />
        <TextArea
          label={t('feedback.tried')}
          value={tried}
          onChange={(e) => setTried(e.target.value)}
        />
        <TextArea
          label={t('feedback.happened')}
          value={happened}
          onChange={(e) => setHappened(e.target.value)}
        />
        <Checkbox
          checked={withReport}
          onChange={(event) => setWithReport(event.target.checked)}
          label={t('feedback.withReport')}
        />
        <Button disabled={!tried.trim()} busy={open.busy} onClick={() => void open.run()}>
          {t('feedback.open')}
        </Button>
      </Stack>
    </Card>
  );
}
