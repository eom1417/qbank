import { useCallback, useState } from 'react';
import type { QuestionResponse } from '../../../contracts/questions.js';
import {
  Alert,
  Button,
  Card,
  MutedText,
  Row,
  SelectField,
  Stack,
  Subtitle,
} from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchBanks } from '../library/api.js';
import { transfer } from './api.js';

/** Moving or copying this question to another bank, told about duplicates there (FR-03-009). */
export function TransferCard({ question }: { question: QuestionResponse }) {
  const { t } = useI18n();
  const load = useCallback(() => fetchBanks(), []);
  const { state } = useQuery(load);
  const [target, setTarget] = useState('');
  const [duplicates, setDuplicates] = useState<number | null>(null);
  const banks =
    state.status === 'ready' ? state.data.banks.filter((b) => b.id !== question.bankId) : [];
  const chosen = target || banks[0]?.id || '';
  const send = useAction(async (mode: 'move' | 'copy') => {
    const result = await transfer({ questionIds: [question.id], targetBankId: chosen, mode });
    setDuplicates(result.duplicates);
  });
  if (state.status !== 'ready') return null;
  return (
    <Card>
      <Stack>
        <Subtitle>{t('transfer.title')}</Subtitle>
        {banks.length === 0 ? (
          <MutedText>{t('transfer.none')}</MutedText>
        ) : (
          <>
            <SelectField
              label={t('transfer.target')}
              value={chosen}
              options={banks.map((b) => ({ value: b.id, label: b.name }))}
              onChange={(e) => setTarget(e.target.value)}
            />
            <Row>
              <Button variant="secondary" busy={send.busy} onClick={() => void send.run('copy')}>
                {t('transfer.copy')}
              </Button>
              <Button variant="secondary" busy={send.busy} onClick={() => void send.run('move')}>
                {t('transfer.move')}
              </Button>
            </Row>
          </>
        )}
        {duplicates !== null && (
          <Alert tone="success">
            {t('transfer.done')} {duplicates}
          </Alert>
        )}
        {send.error && <Alert tone="error">{t(send.error)}</Alert>}
      </Stack>
    </Card>
  );
}
