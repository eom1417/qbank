import { useState } from 'react';
import { NEW_BANK, useImportForm, type ImportForm } from './use-import-form.js';
import { Link, useParams } from 'react-router';
import { Alert, Button, Card, Checkbox, Heading, Stack, Title } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { AiChoice } from './AiChoice.js';
import { DestinationCard } from './DestinationCard.js';
import { FilesCard } from './FilesCard.js';
import { ImportProgressRow } from './ImportProgress.js';

function StartCard({ form }: { form: ImportForm }) {
  const { t } = useI18n();
  const [rights, setRights] = useState(false);
  const { ai, setAi, chooseAi, setReadPages, upload, files, destination } = form;
  const missingName = destination.bankId === NEW_BANK && destination.newName.trim() === '';
  return (
    <Card>
      <AiChoice
        value={ai.choice}
        onChange={chooseAi}
        readPages={ai.readPages}
        onReadPages={setReadPages}
        approval={ai.approval}
        approved={ai.approved}
        onApprove={(approved) => setAi((previous) => ({ ...previous, approved }))}
      />
      <Alert tone="info">{t('import.patientWarning')}</Alert>
      <Checkbox
        checked={rights}
        onChange={(event) => setRights(event.target.checked)}
        label={t('import.rights')}
      />
      {upload.error && <Alert tone="error">{t(upload.error)}</Alert>}
      <Button
        disabled={!rights || files.length === 0 || missingName}
        busy={upload.busy}
        onClick={() => void upload.run()}
      >
        {t('import.submit')}
      </Button>
    </Card>
  );
}

/** Prepare an upload (UI-07): files, their settings, usage rights, and optional AI. */
export function ImportScreen() {
  const { t } = useI18n();
  const bankId = useParams()['bankId'] ?? '';
  const form = useImportForm(bankId);
  const { destination } = form;
  const backTo = destination.bankId === NEW_BANK ? bankId : destination.bankId;
  return (
    <Stack>
      <Link to={`/banks/${backTo}`}>{t('import.back')}</Link>
      <Heading>{t('import.title')}</Heading>
      <DestinationCard key={form.banksVersion} value={destination} onChange={form.setDestination} />
      <FilesCard bankId={backTo} files={form.files} setFiles={form.setFiles} />
      <StartCard form={form} />
      {form.jobs.length > 0 && (
        <Card>
          <Title>{t('import.progress')}</Title>
          <ul className="qb-list">
            {form.jobs.map((job) => (
              <ImportProgressRow key={job.id} initial={job} onCancel={() => form.forget(job.id)} />
            ))}
          </ul>
        </Card>
      )}
    </Stack>
  );
}
