import { useState } from 'react';
import type { ImportResponse } from '../../../contracts/sources.js';
import { ApiError } from '../../platform/api/client.js';
import { errorMessageKey } from '../../platform/api/messages.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { createBank } from '../library/api.js';
import { uploadFile } from './api.js';
import type { ChosenFile } from './FileOptions.js';
import { useTriageChoice, type TriageRequest } from '../providers/use-triage-choice.js';

/** The destination value that means "create a new bank with this name" (FR-04-003). */
export const NEW_BANK = 'new';

export interface Destination {
  bankId: string;
  newName: string;
}

/** The bank the files go to; a new one is created first, once, then chosen. */
function useDestination(bankId: string) {
  const [destination, setDestination] = useState<Destination>({ bankId, newName: '' });
  const [banksVersion, setBanksVersion] = useState(0);
  const resolveBank = async () => {
    if (destination.bankId !== NEW_BANK) return destination.bankId;
    const created = await createBank({ name: destination.newName });
    setDestination({ bankId: created.id, newName: '' });
    setBanksVersion((version) => version + 1);
    return created.id;
  };
  return { destination, setDestination, banksVersion, resolveBank };
}

/**
 * The upload screen's state: destination, chosen files, created imports, the AI choice.
 * Files are uploaded one by one; a file that fails keeps its row with the reason.
 */
/** The upload's AI fields: instance, models per role, mode and improvement, or none. */
function aiFields(request: TriageRequest | null, readPages: boolean) {
  const aiMode = request && readPages ? ('read' as const) : ('verify' as const);
  return { triage: request, aiMode };
}

/** The import's AI: the remembered triage choice, whole-page reading, and any cost approval. */
function useAiOptions() {
  const triage = useTriageChoice();
  const [ai, setAi] = useState({ approved: false, approval: null as string[] | null });
  const [readPages, setReadPages] = useState(false);
  return { triage, ai, setAi, readPages, setReadPages };
}

export function useImportForm(bankId: string) {
  const { t } = useI18n();
  const { destination, setDestination, banksVersion, resolveBank } = useDestination(bankId);
  const [files, setFiles] = useState<ChosenFile[]>([]);
  const [jobs, setJobs] = useState<ImportResponse[]>([]);
  const { triage, ai, setAi, readPages, setReadPages } = useAiOptions();
  const upload = useAction(async () => {
    const target = await resolveBank();
    for (const chosen of files) {
      try {
        const options = {
          ...chosen,
          ...aiFields(triage.request, readPages),
          aiApproved: ai.approved,
        };
        const job = await uploadFile(target, chosen.file, options);
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
  return {
    destination,
    setDestination,
    banksVersion,
    files,
    setFiles,
    jobs,
    ai: { ...ai, readPages },
    triage,
    setReadPages,
    setAi,
    upload,
    forget,
  };
}

export type ImportForm = ReturnType<typeof useImportForm>;
