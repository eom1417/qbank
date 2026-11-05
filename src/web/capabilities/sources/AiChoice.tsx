import { Alert, Checkbox, MutedText, Stack } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { DisclosureNote } from '../providers/DisclosureNote.js';
import { TriageFields } from '../providers/TriageFields.js';
import type { TriageChoiceState } from '../providers/use-triage-choice.js';

/** The user's own AI for this import (optional), what it sends, and cost approval (DEC-18). */
interface AiChoiceProps {
  triage: TriageChoiceState;
  approval: string[] | null;
  approved: boolean;
  onApprove(approved: boolean): void;
  /** The AI reads whole pages instead of only checking open answers. */
  readPages: boolean;
  onReadPages(readPages: boolean): void;
}

export function AiChoice(props: AiChoiceProps) {
  const { triage, approval, approved, onApprove } = props;
  const { t } = useI18n();
  const value = triage.request !== null;
  return (
    <Stack>
      <TriageFields state={triage} />
      {value && (
        <Checkbox
          checked={props.readPages}
          onChange={(event) => props.onReadPages(event.target.checked)}
          label={t('import.ai.read')}
        />
      )}
      {value && <MutedText>{t('import.ai.read.hint')}</MutedText>}
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
