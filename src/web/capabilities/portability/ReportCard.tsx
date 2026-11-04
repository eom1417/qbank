import { useState } from 'react';
import { buttonClass, Card, Row, Stack, Subtitle, TextField } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { reportUrl } from './api.js';

const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

/** A readable report of a period for personal use (FR-18-002, FR-16-011, DEC-19 assumed). */
export function ReportCard() {
  const { t, locale } = useI18n();
  const [from, setFrom] = useState(day(-30));
  const [to, setTo] = useState(day(0));
  return (
    <Card>
      <Stack>
        <Subtitle>{t('report.title')}</Subtitle>
        <Row>
          <TextField
            label={t('report.from')}
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <TextField
            label={t('report.to')}
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Row>
        <a className={buttonClass('secondary')} href={reportUrl(from, to, locale)} download>
          {t('report.download')}
        </a>
      </Stack>
    </Card>
  );
}
