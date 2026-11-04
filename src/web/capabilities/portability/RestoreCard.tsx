import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { RestoreResponse } from '../../../contracts/portability.js';
import {
  Alert,
  Button,
  buttonClass,
  Card,
  MutedText,
  Stack,
  Subtitle,
  TextField,
} from '../../design-system/index.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { restoreBank } from './api.js';

/** What came back, and what did not (FR-18-006). */
function RestoreResult({ result }: { result: RestoreResponse }) {
  const { t } = useI18n();
  return (
    <Stack>
      <Alert tone="success">
        {t('restore.done')} {result.questions} · {t('restore.pictures')} {result.pictures}
      </Alert>
      {result.skipped > 0 && (
        <MutedText>
          {t('restore.skipped')} {result.skipped}
        </MutedText>
      )}
      {result.missingPictures > 0 && (
        <MutedText>
          {t('restore.missing')} {result.missingPictures}
        </MutedText>
      )}
      <Link className={buttonClass('secondary')} to={`/banks/${result.bankId}`}>
        {t('restore.open')}
      </Link>
    </Stack>
  );
}

/** Bringing back an exported bank as a new one (FR-18-005); what was missing is said. */
export function RestoreCard() {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<RestoreResponse | null>(null);
  const run = useAction(async () => {
    if (file) setResult(await restoreBank(file));
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run.run();
  };
  return (
    <Card>
      <form className="qb-stack" onSubmit={submit} noValidate>
        <Subtitle>{t('restore.title')}</Subtitle>
        <MutedText>{t('restore.lead')}</MutedText>
        <TextField
          type="file"
          label={t('restore.file')}
          accept=".zip,application/zip"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {run.error && <Alert tone="error">{t(run.error)}</Alert>}
        <Button type="submit" variant="secondary" busy={run.busy} disabled={!file}>
          {t('restore.submit')}
        </Button>
        {result && <RestoreResult result={result} />}
      </form>
    </Card>
  );
}
