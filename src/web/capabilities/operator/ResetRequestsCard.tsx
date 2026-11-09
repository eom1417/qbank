import { useState } from 'react';
import type { ResetLinkResponse, ResetRequestItem } from '../../../contracts/operator.js';
import {
  Alert,
  Badge,
  Button,
  buttonClass,
  CodeText,
  MutedText,
  Row,
} from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fill } from '../../platform/i18n/fill.js';
import { fetchResets, resetLink } from './api.js';
import { OperatorCard, useWhen } from './OperatorCard.js';
import { whatsappUrl } from './view.js';

/** Copies to the clipboard; false where there is none (plain http): the link is shown anyway. */
async function copyText(text: string): Promise<boolean> {
  if (!navigator.clipboard) return false;
  return navigator.clipboard.writeText(text).then(
    () => true,
    () => false,
  );
}

/** The ready-to-send message: the person's name and their link. */
function useResetMessage() {
  const { t } = useI18n();
  return (item: ResetRequestItem, link: string) =>
    fill(t('operator.resets.message'), { name: item.displayName, link });
}

interface LinkProps {
  item: ResetRequestItem;
  made: ResetLinkResponse;
  copied: boolean;
  onCopied(): void;
}

/** The link once made: shown in full, with copy and WhatsApp, and why it is new if it is. */
function LinkReady({ item, made, copied, onCopied }: LinkProps) {
  const { t } = useI18n();
  const when = useWhen();
  const message = useResetMessage();
  const copy = () => void copyText(made.link).then((done) => done && onCopied());
  return (
    <>
      {made.fresh && (
        <Alert tone="info">
          {fill(t('operator.resets.fresh'), { when: when(made.expiresAt) })}
        </Alert>
      )}
      <CodeText>{made.link}</CodeText>
      <Row>
        <Button variant="secondary" onClick={copy}>
          {t(copied ? 'operator.resets.copied' : 'operator.resets.copy')}
        </Button>
        <a
          className={buttonClass('secondary')}
          href={whatsappUrl(message(item, made.link))}
          target="_blank"
          rel="noreferrer noopener"
        >
          {t('operator.resets.whatsapp')}
        </a>
      </Row>
    </>
  );
}

/** Who asked and when; an expired request says a new link will be made. */
function RequestSummary({
  item,
  made,
}: {
  item: ResetRequestItem;
  made: ResetLinkResponse | null;
}) {
  const { t } = useI18n();
  const when = useWhen();
  const expired = item.expired && !made;
  return (
    <>
      <Row>
        <bdi className="qb-grow">
          {item.displayName} · {item.email}
        </bdi>
        {expired && <Badge>{t('operator.resets.expired')}</Badge>}
      </Row>
      <MutedText>
        {fill(t('operator.resets.requested'), { when: when(item.requestedAt) })} ·{' '}
        {fill(t('operator.resets.validUntil'), { when: when(made?.expiresAt ?? item.expiresAt) })}
      </MutedText>
      {expired && <MutedText>{t('operator.resets.expiredHint')}</MutedText>}
    </>
  );
}

/**
 * One request. Either button asks the server for the link (it logs each one); copying puts it
 * on the clipboard, WhatsApp opens a chat with the message ready.
 */
function ResetRow({ item }: { item: ResetRequestItem }) {
  const { t } = useI18n();
  const message = useResetMessage();
  const [made, setMade] = useState<ResetLinkResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const get = useAction(async (then: 'copy' | 'whatsapp') => {
    const link = await resetLink(item.accountId);
    setMade(link);
    if (then === 'whatsapp')
      window.open(whatsappUrl(message(item, link.link)), '_blank', 'noopener');
    else setCopied(await copyText(link.link));
  });
  return (
    <li className="qb-list__item">
      <RequestSummary item={item} made={made} />
      {get.error && <Alert tone="error">{t(get.error)}</Alert>}
      {made ? (
        <LinkReady item={item} made={made} copied={copied} onCopied={() => setCopied(true)} />
      ) : (
        <Row>
          <Button variant="secondary" busy={get.busy} onClick={() => void get.run('copy')}>
            {t('operator.resets.copy')}
          </Button>
          <Button variant="secondary" busy={get.busy} onClick={() => void get.run('whatsapp')}>
            {t('operator.resets.whatsapp')}
          </Button>
        </Row>
      )}
    </li>
  );
}

/** "Forgot password" requests waiting for the operator to pass the link on by hand (B4). */
export function ResetRequestsCard() {
  const { t } = useI18n();
  const { state, reload } = useQuery(fetchResets);
  return (
    <OperatorCard
      title={t('operator.resets.title')}
      lead={t('operator.resets.lead')}
      state={state}
      onRefresh={reload}
    >
      {(data) =>
        data.items.length === 0 ? (
          <MutedText>{t('operator.resets.empty')}</MutedText>
        ) : (
          <ul className="qb-list">
            {data.items.map((item) => (
              <ResetRow key={item.accountId} item={item} />
            ))}
          </ul>
        )
      }
    </OperatorCard>
  );
}
