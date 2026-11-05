import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert, Button, MutedText, Stack } from '../../design-system/index.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { TriageFields } from '../providers/TriageFields.js';
import { useTriageChoice } from '../providers/use-triage-choice.js';
import { recheckSource } from './api.js';

/**
 * "Check again with AI" on one source (DEC-33): the same AI choice as an import, then its
 * report. The file is not read again, so it works after the original was deleted.
 */
export function RecheckPanel({ sourceId }: { sourceId: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const triage = useTriageChoice();
  const start = useAction(async () => {
    if (!triage.request) return;
    const job = await recheckSource(sourceId, triage.request);
    void navigate(`/imports/${job.id}`);
  });
  if (!open)
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t('triage.recheck')}
      </Button>
    );
  return (
    <Stack>
      <MutedText>{t('triage.recheck.lead')}</MutedText>
      <TriageFields state={triage} />
      <Button disabled={!triage.request} busy={start.busy} onClick={() => void start.run()}>
        {t('triage.recheck.start')}
      </Button>
      {start.error && <Alert tone="error">{t(start.error)}</Alert>}
    </Stack>
  );
}
