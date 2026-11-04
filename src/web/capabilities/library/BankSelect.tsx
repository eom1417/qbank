import { useCallback } from 'react';
import { SelectField } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchBanks } from './api.js';

interface Props {
  value: string;
  onChange(bankId: string): void;
}

/** Choosing one of the account's banks, or all of them (empty value). */
export function BankSelect({ value, onChange }: Props) {
  const { t } = useI18n();
  const { state } = useQuery(useCallback(() => fetchBanks(), []));
  const banks = state.status === 'ready' ? state.data.banks : [];
  const options = [
    { value: '', label: t('analytics.allBanks') },
    ...banks.map((b) => ({ value: b.id, label: b.name })),
  ];
  return (
    <SelectField
      label={t('analytics.bank')}
      value={value}
      options={options}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
