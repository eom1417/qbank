import type { CreateBankRequest } from '../../../../contracts/library.js';
import type { Clock } from '../../../platform/clock.js';
import { notFound } from '../../../platform/errors/index.js';
import { isId } from '../../../platform/ids.js';
import type { Actor } from '../../identity/index.js';
import type { BankRepository } from '../adapters/bank-repository.js';
import { compareForLibrary, type Bank } from '../domain/bank.js';

export interface LibraryDeps {
  banks: BankRepository;
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

export async function listBanks(deps: LibraryDeps, actor: Actor): Promise<Bank[]> {
  const banks = await deps.banks.listOwned(actor.accountId);
  return banks.sort(compareForLibrary);
}

export async function getBank(deps: LibraryDeps, actor: Actor, id: string): Promise<Bank> {
  const bank = isId(id) ? await deps.banks.findOwned(actor.accountId, id) : undefined;
  if (!bank) throw notFound();
  return bank;
}
