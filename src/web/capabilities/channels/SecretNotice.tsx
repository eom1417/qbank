import type { ShareSecretResponse } from '../../../contracts/sharing.js';
import {
  Alert,
  Button,
  CodeText,
  MutedText,
  QrCode,
  Row,
  Stack,
} from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { CopyButton } from './CopyButton.js';

/** Something to copy exactly, with its button. */
function Copyable({ text }: { text: string }) {
  return (
    <Row>
      <CodeText>{text}</CodeText>
      <CopyButton text={text} />
    </Row>
  );
}

/** How an outside program uses its key: the batch call, or an MCP client. */
function AgentUse({ secret }: { secret: string }) {
  const { t } = useI18n();
  const origin = window.location.origin;
  return (
    <>
      <MutedText>{t('sharing.secret.example')}</MutedText>
      <CodeText>{`curl -X POST ${origin}/api/channel/v1/batches -H "Authorization: Bearer ${secret}"`}</CodeText>
      <MutedText>{t('sharing.secret.mcp')}</MutedText>
      <CodeText>{`${origin}/api/channel/v1/mcp`}</CodeText>
    </>
  );
}

interface Props {
  created: ShareSecretResponse;
  onDone(): void;
}

/** A new key (agent) or link (people), shown this once with copy and, for a link, a QR code. */
export function SecretNotice({ created, onDone }: Props) {
  const { t } = useI18n();
  const link = created.link === null ? null : `${window.location.origin}${created.link}`;
  return (
    <Alert tone="success">
      <Stack>
        <strong>{t(link ? 'sharing.secret.linkTitle' : 'sharing.secret.keyTitle')}</strong>
        <MutedText>{t('sharing.secret.once')}</MutedText>
        <Copyable text={link ?? created.secret} />
        {link && <QrCode value={link} label={t('sharing.secret.qr')} />}
        {!link && <AgentUse secret={created.secret} />}
        <Row>
          <Button variant="ghost" onClick={onDone}>
            {t('sharing.secret.hide')}
          </Button>
        </Row>
      </Stack>
    </Alert>
  );
}
