import { useCallback } from 'react';
import { MutedText, SelectField } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchSources } from './api.js';

interface AnswersForProps {
  bankId: string;
  value: string;
  onChange(sourceId: string): void;
}

/** For an answer-key file: which of the bank's question files it answers (M6.3, JY-03). */
export function AnswersForField({ bankId, value, onChange }: AnswersForProps) {
  const { t } = useI18n();
  const load = useCallback(() => fetchSources(bankId), [bankId]);
  const { state } = useQuery(load);
  const sources =
    state.status === 'ready'
      ? state.data.sources.filter((source) => source.sourceType !== 'answer_key')
      : [];
  const options = [
    { value: '', label: '—' },
    ...sources.map((source) => ({ value: source.id, label: source.fileName })),
  ];
  return (
    <>
      <SelectField
        label={t('import.answersFor')}
        options={options}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <MutedText>{t('import.answersForHint')}</MutedText>
    </>
  );
}
