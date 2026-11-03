import type { ProviderView } from '../../../contracts/providers.js';
import { Alert, Button, MutedText, Row, Stack } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { FlowInteraction } from './FlowInteraction.js';
import { useSignIn } from './use-sign-in.js';

/** The start button, when the provider can sign in and is not signed in yet. */
function StartButton({ provider, start }: { provider: ProviderView; start(): void }) {
  const { t } = useI18n();
  if (!provider.setup?.canAuthenticate || provider.auth.status === 'authenticated') return null;
  return <Button onClick={start}>{t('providers.signIn')}</Button>;
}

/** Signing in to a subscription (ChatGPT for Codex, Google for Antigravity, keys for others). */
export function SignInPanel({
  provider,
  onError,
}: {
  provider: ProviderView;
  onError(error: unknown): void;
}) {
  const { t } = useI18n();
  const signIn = useSignIn(provider.instanceId, onError);
  const { flow } = signIn;
  if (!flow) return <StartButton provider={provider} start={() => void signIn.start()} />;
  if (flow.phase === 'succeeded') return <Alert tone="success">{t('signIn.succeeded')}</Alert>;
  const others = (flow.methods ?? []).slice(1);
  return (
    <Stack>
      {flow.message && <MutedText>{flow.message}</MutedText>}
      {flow.phase === 'failed' && <Alert tone="error">{flow.message ?? t('signIn.waiting')}</Alert>}
      {flow.interaction ? (
        <FlowInteraction interaction={flow.interaction} signIn={signIn} />
      ) : (
        <MutedText>{t('signIn.waiting')}</MutedText>
      )}
      <Row>
        {others.map((method) => (
          <Button key={method.id} variant="ghost" onClick={() => void signIn.start(method.id)}>
            {method.name}
          </Button>
        ))}
        <Button
          variant="ghost"
          onClick={() => void (flow.phase === 'failed' ? signIn.close() : signIn.cancel())}
        >
          {t('signIn.cancel')}
        </Button>
      </Row>
    </Stack>
  );
}
