import { Alert, Checkbox, MutedText, SelectField, Stack } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { DisclosureNote } from '../ai/AiAboutCard.js';
import { fetchConnections } from './api.js';

/** The user's own AI for this import (optional), what it sends, and cost approval (DEC-18). */
interface AiChoiceProps {
  value: string;
  onChange(id: string): void;
  approval: string[] | null;
  approved: boolean;
  onApprove(approved: boolean): void;
}

export function AiChoice({ value, onChange, approval, approved, onApprove }: AiChoiceProps) {
  const { t } = useI18n();
  const { state } = useQuery(fetchConnections);
  const providers = state.status === 'ready' ? state.data.providers : [];
  const options = [
    { value: '', label: t('import.ai.none') },
    ...providers.map((p) => ({ value: p.id, label: p.label })),
  ];
  return (
    <Stack>
      <SelectField
        label={t('import.ai.label')}
        options={options}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <MutedText>{t(value ? 'import.ai.with' : 'import.ai.without')}</MutedText>
      {value && <DisclosureNote />}
      {approval && (
        <Alert tone="info">
          {t('ai.estimate.approval')}{' '}
          {approval
            .map((reason) => t(`ai.reason.${reason}` as 'ai.reason.over_page_limit'))
            .join('، ')}
        </Alert>
      )}
      {approval && (
        <Checkbox
          checked={approved}
          onChange={(event) => onApprove(event.target.checked)}
          label={t('import.ai.approve')}
        />
      )}
    </Stack>
  );
}
