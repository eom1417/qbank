import type {
  BankListFilter,
  CreateBankRequest,
  UpdateBankRequest,
} from '../../../../contracts/library.js';
import type { Clock } from '../../../platform/clock.js';
import { notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { Actor } from '../../identity/index.js';
import type { BankRepository } from '../adapters/bank-repository.js';
import type { TaxonomyRepository } from '../adapters/taxonomy-repository.js';
import type { TagRepository } from '../adapters/tag-repository.js';
import { compareForLibrary, type Bank } from '../domain/bank.js';

export interface LibraryDeps {
  banks: BankRepository;
  taxonomy: TaxonomyRepository;
  tags: TagRepository;
  clock: Clock;
  newId: () => string;
}

export async function createBank(
  deps: LibraryDeps,
  actor: Actor,
  input: CreateBankRequest,
): Promise<Bank> {
  const now = deps.clock.now();
  const bank: Bank = {
    id: deps.newId(),
    ownerId: actor.accountId,
    name: input.name,
    description: input.description,
    subject: input.subject,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await deps.banks.insert(bank);
  return bank;
}

export async function listBanks(
  deps: LibraryDeps,
  actor: Actor,
  filter: BankListFilter,
): Promise<Bank[]> {
  const banks = await deps.banks.listOwned(actor.accountId, filter);
  return banks.sort(compareForLibrary);
}

export async function getBank(deps: LibraryDeps, actor: Actor, id: string): Promise<Bank> {
  const bank = isId(id) ? await deps.banks.findOwned(actor.accountId, id) : undefined;
  if (!bank) throw notFound();
  return bank;
}

async function changeBank(
  deps: LibraryDeps,
  actor: Actor,
  id: string,
  changes: UpdateBankRequest & { archivedAt?: Date | null },
): Promise<Bank> {
  const updatedAt = deps.clock.now();
  const bank = isId(id)
    ? await deps.banks.update(actor.accountId, id, { ...changes, updatedAt })
    : undefined;
  if (!bank) throw notFound();
  return bank;
}

export const updateBank = (deps: LibraryDeps, actor: Actor, id: string, input: UpdateBankRequest) =>
  changeBank(deps, actor, id, input);

/** Archiving hides a bank from the default library view; nothing is deleted (FR-19-008). */
export const archiveBank = (deps: LibraryDeps, actor: Actor, id: string) =>
  changeBank(deps, actor, id, { archivedAt: deps.clock.now() });

export const restoreBank = (deps: LibraryDeps, actor: Actor, id: string) =>
  changeBank(deps, actor, id, { archivedAt: null });
