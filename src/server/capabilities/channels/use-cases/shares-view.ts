import type {
  ShareEventsResponse,
  ShareListResponse,
  ShareSecretResponse,
  ShareView,
} from '../../../../contracts/sharing.js';
import { notFound } from '../../../platform/errors/index.js';
import type { Actor } from '../../identity/index.js';
import type { ChannelRow } from '../adapters/channel-repository.js';
import { statusOf } from '../domain/policy.js';
import type { ChannelsDeps } from './deps.js';
import { shareOf } from './governance.js';
import { ownedBank, ownedChannel, readyQuestions } from './manage.js';

/** The owner's view of shares: status derived now, ready after reservations, uses counted. */
async function viewsOf(
  deps: ChannelsDeps,
  ownerId: string,
  rows: readonly ChannelRow[],
): Promise<ShareView[]> {
  const uses = await deps.shares.usesOf(
    ownerId,
    rows.map((row) => row.id),
  );
  const names = new Map<string, Promise<string | null>>();
  const bankName = (bankId: string) => {
    if (!names.has(bankId)) names.set(bankId, deps.bankNameOf(ownerId, bankId));
    return names.get(bankId) as Promise<string | null>;
  };
  const now = deps.clock.now();
  return Promise.all(
    rows.map(async (row) => {
      const share = shareOf(row);
      return {
        id: row.id,
        bankId: row.bank_id,
        bankName: (await bankName(row.bank_id)) ?? '',
        kind: share.kind,
        name: row.name,
        policy: share.policy,
        version: row.version,
        status: statusOf(share, now),
        keyPrefix: row.key_prefix,
        createdAt: row.created_at.toISOString(),
        lastUsedAt: row.last_used_at?.toISOString() ?? null,
        ready: (await readyQuestions(deps, row)).length,
        uses: uses.get(row.id) ?? 0,
      };
    }),
  );
}

export async function viewOf(deps: ChannelsDeps, row: ChannelRow): Promise<ShareView> {
  const [view] = await viewsOf(deps, row.owner_id, [row]);
  if (!view) throw notFound();
  return view;
}

/** A new share or a renewed secret: the secret in this answer only, and a link's path. */
export async function secretResponse(
  deps: ChannelsDeps,
  row: ChannelRow,
  secret: string,
): Promise<ShareSecretResponse> {
  return {
    share: await viewOf(deps, row),
    secret,
    link: row.kind === 'agent' ? null : `/t/${secret}`,
  };
}

/** The bank's shares, or (no bank) every share of the account: the sharing hub. */
export async function listShares(
  deps: ChannelsDeps,
  actor: Actor,
  bankId: string | undefined,
): Promise<ShareListResponse> {
  if (bankId !== undefined) await ownedBank(deps, actor, bankId);
  const rows = await deps.shares.listOfAccount(actor.accountId, bankId);
  return { shares: await viewsOf(deps, actor.accountId, rows) };
}

export async function shareView(deps: ChannelsDeps, actor: Actor, id: string) {
  return viewOf(deps, await ownedChannel(deps, actor, id));
}

/** The share's append-only record, newest first. */
export async function shareEvents(
  deps: ChannelsDeps,
  actor: Actor,
  id: string,
): Promise<ShareEventsResponse> {
  const row = await ownedChannel(deps, actor, id);
  const events = await deps.ledger.eventsOf(actor.accountId, row.id);
  return {
    events: events.map((event) => ({
      at: event.at.toISOString(),
      type: event.type as ShareEventsResponse['events'][number]['type'],
      version: event.version,
      detail: (event.detail ?? {}) as ShareEventsResponse['events'][number]['detail'],
    })),
  };
}
