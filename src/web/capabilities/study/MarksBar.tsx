import { useState } from 'react';
import type { ItemResponse } from '../../../contracts/study.js';
import { Alert, Button, Row, SelectField } from '../../design-system/index.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { reportQuestion, setMark } from './api.js';

const REPORTS = ['ambiguous', 'image_missing', 'wrong_key', 'other'] as const;

type ReportKind = (typeof REPORTS)[number];

/** Choosing what is wrong and sending it to review; nothing changes on its own. */
function ReportForm({ questionId, onSent }: { questionId: string; onSent(): void }) {
  const { t } = useI18n();
  const [kind, setKind] = useState<ReportKind>('ambiguous');
  const report = useAction(async () => {
    await reportQuestion(questionId, kind);
    onSent();
  });
  return (
    <Row>
      <SelectField
        label={t('study.report.kind')}
        value={kind}
        options={REPORTS.map((k) => ({ value: k, label: t(`editor.report.${k}`) }))}
        onChange={(e) => setKind(e.target.value as ReportKind)}
      />
      <Button variant="secondary" busy={report.busy} onClick={() => void report.run()}>
        {t('study.report.send')}
      </Button>
    </Row>
  );
}

/** Flag, favourite and report (FR-12-007, FR-09-010): none of them is an answer. */
export function MarksBar({
  item,
  onChange,
}: {
  item: ItemResponse;
  onChange(item: ItemResponse): void;
}) {
  const { t } = useI18n();
  const [reporting, setReporting] = useState(false);
  const [sent, setSent] = useState(false);
  const questionId = item.questionId;
  const mark = useAction(async (change: { flagged?: boolean; favorite?: boolean }) => {
    if (questionId) onChange({ ...item, ...(await setMark(questionId, change)) });
  });
  if (!questionId) return null;
  return (
    <>
      <Row>
        <Button
          variant="ghost"
          busy={mark.busy}
          onClick={() => void mark.run({ flagged: !item.flagged })}
        >
          {t(item.flagged ? 'study.unflag' : 'study.flag')}
        </Button>
        <Button
          variant="ghost"
          busy={mark.busy}
          onClick={() => void mark.run({ favorite: !item.favorite })}
        >
          {t(item.favorite ? 'study.unfavorite' : 'study.favorite')}
        </Button>
        <Button variant="ghost" onClick={() => setReporting(!reporting)}>
          {t('study.report')}
        </Button>
      </Row>
      {reporting && (
        <ReportForm
          questionId={questionId}
          onSent={() => {
            setSent(true);
            setReporting(false);
          }}
        />
      )}
      {sent && <Alert tone="success">{t('study.report.sent')}</Alert>}
    </>
  );
}
