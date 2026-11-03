import { useState } from 'react';
import type { ImportResponse } from '../../../contracts/sources.js';
import { ApiError } from '../../platform/api/client.js';
import { errorMessageKey } from '../../platform/api/messages.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { uploadFile } from './api.js';
import type { ChosenFile } from './FileOptions.js';

/**
 * The upload screen's state: chosen files, created imports, the AI choice and its approval.
 * Files are uploaded one by one; a file that fails keeps its row with the reason.
 */
export function useImportForm(bankId: string) {
  const { t } = useI18n();
  const [files, setFiles] = useState<ChosenFile[]>([]);
  const [jobs, setJobs] = useState<ImportResponse[]>([]);
  const [ai, setAi] = useState({
    providerId: '',
    approved: false,
    approval: null as string[] | null,
  });
  const upload = useAction(async () => {
    for (const chosen of files) {
      try {
        const options = { ...chosen, aiProviderId: ai.providerId, aiApproved: ai.approved };
        const job = await uploadFile(bankId, chosen.file, options);
        setJobs((previous) => [...previous, job]);
        setFiles((previous) => previous.filter((other) => other.key !== chosen.key));
      } catch (error) {
        if (error instanceof ApiError && error.code === 'approval_required') {
          setAi((previous) => ({ ...previous, approval: Object.keys(error.fields) }));
          return;
        }
        const message = t(errorMessageKey(error));
        setFiles((previous) =>
          previous.map((other) =>
            other.key === chosen.key ? { ...other, error: message } : other,
          ),
        );
      }
    }
  });
  const forget = (id: string) => setJobs((previous) => previous.filter((job) => job.id !== id));
  return { files, setFiles, jobs, ai, setAi, upload, forget };
}

export type ImportForm = ReturnType<typeof useImportForm>;
