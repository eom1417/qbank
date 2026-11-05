import type {
  AccountDeletionResponse,
  BankDeletionImpact,
} from '../../../../contracts/portability.js';
import { notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { Actor } from '../../identity/index.js';
import type { PortabilityDeps } from './deps.js';

async function ownedBankId(deps: PortabilityDeps, actor: Actor, bankId: string) {
  if (!isId(bankId) || !(await deps.library.findBank(actor.accountId, bankId))) throw notFound();
  return bankId;
}

/** What deleting the bank takes with it, open sessions included (FR-19-005, FR-23-008). */
export async function bankDeletionImpact(
  deps: PortabilityDeps,
  actor: Actor,
  bankId: string,
): Promise<BankDeletionImpact> {
  const id = await ownedBankId(deps, actor, bankId);
  const footprint = await deps.questions.bankFootprint(actor.accountId, id);
  const sources = await deps.sources.sourcesOfBank(actor.accountId, id);
  const sessions = await deps.study.sessionsTouching(actor.accountId, footprint.questionIds);
  return {
    questions: footprint.questions,
    pictures: footprint.pictures,
    sources: sources.length,
    notes: footprint.notes,
    sessions: sessions.sessions,
    activeSessions: sessions.active,
  };
}

/** Removes stored files; one already gone is not an error. */
async function eraseFiles(deps: PortabilityDeps, keys: readonly string[]) {
  for (const key of keys) await deps.blobs.remove(key).catch(() => undefined);
}

/**
 * Deletes one bank for good (FR-19-005, JY-16): its questions leave every session (DEC-20
 * assumed), the bank goes with all it holds, then its stored files. Other banks and their
 * results are untouched (UAT-074).
 */
export async function deleteBank(deps: PortabilityDeps, actor: Actor, bankId: string) {
  const id = await ownedBankId(deps, actor, bankId);
  const footprint = await deps.questions.bankFootprint(actor.accountId, id);
  const originals = await deps.sources.originalsOfBank(actor.accountId, id);
  await deps.study.forgetQuestions(actor.accountId, footprint.questionIds);
  await deps.library.deleteBank(actor.accountId, id);
  await eraseFiles(deps, [...originals, ...footprint.pictureBlobs]);
}

/**
 * Deletes the account as a task with an honest report (FR-19-006, FR-19-007, UAT-075): the
 * banks and their files first, then its AI sign-ins and keys, then the account with everything
 * left. A step that fails stops
 * the rest and is reported as not done; nothing is said done before it is.
 */
export async function deleteAccount(
  deps: PortabilityDeps,
  actor: Actor,
): Promise<AccountDeletionResponse> {
  const steps: AccountDeletionResponse['steps'] = [
    { step: 'banks', done: false },
    { step: 'files', done: false },
    { step: 'providers', done: false },
    { step: 'account', done: false },
  ];
  const mark = (index: number) => ((steps[index] as { done: boolean }).done = true);
  try {
    const files: string[] = [];
    for (const bankId of await deps.library.bankIdsOf(actor.accountId)) {
      const footprint = await deps.questions.bankFootprint(actor.accountId, bankId);
      files.push(
        ...(await deps.sources.originalsOfBank(actor.accountId, bankId)),
        ...footprint.pictureBlobs,
      );
      await deps.library.deleteBank(actor.accountId, bankId);
    }
    mark(0);
    await eraseFiles(deps, files);
    mark(1);
    await deps.forgetAi(actor.accountId);
    mark(2);
    if (await deps.deleteAccount(actor.accountId)) mark(3);
  } catch {
    // The report below says which steps were not done.
  }
  return { complete: steps.every((s) => s.done), steps };
}
