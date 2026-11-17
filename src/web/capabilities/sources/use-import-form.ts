import { useState } from 'react';
import type { ImportResponse, ModelTier } from '../../../contracts/sources.js';
import { ApiError } from '../../platform/api/client.js';
import { errorMessageKey } from '../../platform/api/messages.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { createBank } from '../library/api.js';
import { uploadFile } from './api.js';
import type { ChosenFile } from './FileOptions.js';
import { useTriageChoice, type TriageRequest } from '../providers/use-triage-choice.js';
import { useSession } from '../identity/session.js';

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
/**
 * The upload's AI fields: instance, models per role, mode and improvement, or none. A server
 * reads with the pipeline (M34); a local install checks open answers or reads whole pages.
 */
function aiFields(request: TriageRequest | null, readPages: boolean, pipeline: boolean) {
  const local = request && readPages ? ('read' as const) : ('verify' as const);
  return { triage: request, aiMode: request && pipeline ? ('pipeline' as const) : local };
}

/** The import's AI: the remembered triage choice, whole-page reading, and any cost approval. */
function useAiOptions() {
  const triage = useTriageChoice();
  const session = useSession();
  const [ai, setAi] = useState({ approved: false, approval: null as string[] | null });
  const [readPages, setReadPages] = useState(false);
  const [consent, setConsent] = useState(false);
  const [tier, setTier] = useState<ModelTier>('light');
  const pipeline = session.mode === 'accounts';
  const account = session.state.status === 'signed-in' ? session.state.account : null;
  // Once per account (Q8): asked only while the account has not agreed yet.
  const consentNeeded = pipeline && triage.request !== null && !account?.aiConsentAt;
  const pipelineConsent = { needed: consentNeeded, given: consent, onChange: setConsent };
  const consentFirst = async () => {
    if (consentNeeded && consent) await session.consentToAi();
  };
  const tierChoice = { tier, onTier: setTier };
  /** What each upload sends of the AI choice. */
  const uploadFields = () => ({
    ...aiFields(triage.request, readPages, pipeline),
    aiApproved: ai.approved,
    aiTier: tier,
  });
  return {
    uploadFields,
    triage,
    ai,
    setAi,
    readPages,
    setReadPages,
    pipeline,
    pipelineConsent,
    consentFirst,
    tierChoice,
  };
}

export function useImportForm(bankId: string) {
  const { t } = useI18n();
  const { destination, setDestination, banksVersion, resolveBank } = useDestination(bankId);
  const [files, setFiles] = useState<ChosenFile[]>([]);
  const [jobs, setJobs] = useState<ImportResponse[]>([]);
  const { triage, ai, setAi, readPages, setReadPages, ...pipeline } = useAiOptions();
  const upload = useAction(async () => {
    await pipeline.consentFirst();
    const target = await resolveBank();
    for (const chosen of files) {
      try {
        const options = { ...chosen, ...pipeline.uploadFields() };
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
    ai: { ...ai, readPages, pipeline: pipeline.pipeline },
    consent: pipeline.pipelineConsent,
    tier: pipeline.tierChoice,
    triage,
    setReadPages,
    setAi,
    upload,
    forget,
  };
}

export type ImportForm = ReturnType<typeof useImportForm>;
