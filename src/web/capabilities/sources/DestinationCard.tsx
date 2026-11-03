import { Card, SelectField, TextField } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchBanks } from '../library/api.js';
import { NEW_BANK, type Destination } from './use-import-form.js';

const fetchActiveBanks = () => fetchBanks();

interface DestinationProps {
  value: Destination;
  onChange(value: Destination): void;
}

/**
 * Where the files go (FR-04-003): any of the user's active banks, or a new one. The screen
 * mounts it again after creating a bank, so the list includes it.
 */
export function DestinationCard({ value, onChange }: DestinationProps) {
  const { t } = useI18n();
  const { state } = useQuery(fetchActiveBanks);
  const banks = state.status === 'ready' ? state.data.banks : [];
  const options = [
    ...banks.map((bank) => ({ value: bank.id, label: bank.name })),
    { value: NEW_BANK, label: t('import.destination.new') },
  ];
  return (
    <Card>
      <SelectField
        label={t('import.destination')}
        options={options}
        value={value.bankId}
        onChange={(event) => onChange({ ...value, bankId: event.target.value })}
      />
      {value.bankId === NEW_BANK && (
        <TextField
          label={t('import.destination.newName')}
          value={value.newName}
          onChange={(event) => onChange({ ...value, newName: event.target.value })}
        />
      )}
    </Card>
  );
}
