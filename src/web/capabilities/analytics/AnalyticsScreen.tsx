import { useCallback, useState } from 'react';
import { Alert, Heading, MutedText, Row, SelectField, Stack } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchBanks } from '../library/api.js';
import { BankSelect } from '../library/BankSelect.js';
import { TopicsCard } from '../study/TopicsCard.js';
import { fetchSummary } from './api.js';
import { HistoryCard, ImportsCard, SuggestionCard, TrendCard } from './ReportCards.js';
import { SummaryCards } from './SummaryCards.js';

/** The figures of one bank or all; changing the filter changes every figure (UAT-066). */
function Figures({
  bankId,
  mode,
  allBankIds,
}: {
  bankId: string;
  mode: string;
  allBankIds: string[];
}) {
  const { t } = useI18n();
  const { state } = useQuery(useCallback(() => fetchSummary(bankId), [bankId]));
  const bankIds = bankId ? [bankId] : allBankIds;
  return (
    <>
      {state.status === 'error' && <Alert tone="error">{t(state.error)}</Alert>}
      {state.status === 'ready' && <SummaryCards summary={state.data} />}
      <SuggestionCard bankId={bankId} />
      <TrendCard bankId={bankId} />
      {bankIds.length > 0 && <TopicsCard bankIds={bankIds} />}
      <HistoryCard bankId={bankId} mode={mode} />
      {bankId && <ImportsCard bankId={bankId} />}
    </>
  );
}

/** Real progress (UI-21): figures, weaknesses, trend and sessions, by bank and mode (FR-16-008). */
export function AnalyticsScreen() {
  const { t } = useI18n();
  const banks = useQuery(useCallback(() => fetchBanks(), [])).state;
  const [bankId, setBankId] = useState('');
  const [mode, setMode] = useState('');
  if (banks.status !== 'ready') return <MutedText>{t('common.loading')}</MutedText>;
  const modes = [
    { value: '', label: t('analytics.mode.all') },
    { value: 'tutor', label: t('exam.mode.tutor') },
    { value: 'exam', label: t('exam.mode.exam') },
  ];
  return (
    <Stack>
      <Heading>{t('analytics.title')}</Heading>
      <Row>
        <BankSelect value={bankId} onChange={setBankId} />
        <SelectField
          label={t('analytics.mode')}
          value={mode}
          options={modes}
          onChange={(e) => setMode(e.target.value)}
        />
      </Row>
      <Figures
        key={`${bankId}:${mode}`}
        bankId={bankId}
        mode={mode}
        allBankIds={banks.data.banks.map((b) => b.id)}
      />
    </Stack>
  );
}
