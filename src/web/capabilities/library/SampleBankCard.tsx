import { useNavigate } from 'react-router';
import { Alert, Button, Card, MutedText, Stack, Title } from '../../design-system/index.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { importSample } from '../sources/api.js';
import { createBank } from './api.js';

/**
 * A new owner's first two minutes (M28.1): a bank of ten questions with answers and explanations,
 * made in one click, read by the rules on this computer, ready to study before any file of theirs.
 */
export function SampleBankCard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const start = useAction(async () => {
    const bank = await createBank({ name: t('sample.bankName') });
    const job = await importSample(bank.id);
    void navigate(`/imports/${job.id}`);
  });
  return (
    <Card>
      <Stack>
        <Title>{t('sample.title')}</Title>
        <MutedText>{t('sample.lead')}</MutedText>
        {start.error && <Alert tone="error">{t(start.error)}</Alert>}
        <Button busy={start.busy} onClick={() => void start.run()}>
          {t('sample.start')}
        </Button>
      </Stack>
    </Card>
  );
}
