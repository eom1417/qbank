import { useState } from 'react';
import type { AuthStateView } from '../../../contracts/providers.js';
import { Button, buttonClass, MutedText, Stack, TextField } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import type { SignIn } from './use-sign-in.js';

type Interaction = NonNullable<AuthStateView['interaction']>;

/** A browser sign-in: open the page, then paste back where it ended (the app is not on 127.0.0.1). */
function BrowserStep({ url, signIn }: { url: string; signIn: SignIn }) {
  const { t } = useI18n();
  const [callback, setCallback] = useState('');
  return (
    <Stack>
      <a className={buttonClass()} href={url} target="_blank" rel="noreferrer noopener">
        {t('signIn.open')}
      </a>
      <TextField
        label={t('signIn.callback')}
        value={callback}
        onChange={(event) => setCallback(event.target.value)}
      />
      <Button
        variant="secondary"
        disabled={!callback.trim()}
        onClick={() => void signIn.complete(callback.trim())}
      >
        {t('signIn.complete')}
      </Button>
    </Stack>
  );
}

/** Fields a provider asks for (an API key, an account id), sent once to the kit. */
function CredentialsStep({
  interaction,
  signIn,
}: {
  interaction: Extract<Interaction, { type: 'credentials' }>;
  signIn: SignIn;
}) {
  const { t } = useI18n();
  const [values, setValues] = useState<Record<string, string>>({});
  return (
    <Stack>
      {interaction.fields.map((field) => (
        <TextField
          key={field.name}
          label={field.label}
          type={field.secret ? 'password' : 'text'}
          autoComplete="off"
          value={values[field.name] ?? ''}
          onChange={(event) => setValues({ ...values, [field.name]: event.target.value })}
        />
      ))}
      <Button onClick={() => void signIn.respond(interaction.id, values)}>
        {t('signIn.submit')}
      </Button>
    </Stack>
  );
}

/** What the current step of a sign-in asks of the user. */
export function FlowInteraction({
  interaction,
  signIn,
}: {
  interaction: Interaction;
  signIn: SignIn;
}) {
  const { t } = useI18n();
  if (interaction.type === 'browser') return <BrowserStep url={interaction.url} signIn={signIn} />;
  if (interaction.type === 'credentials')
    return <CredentialsStep interaction={interaction} signIn={signIn} />;
  if (interaction.type === 'deviceCode')
    return (
      <Stack>
        <MutedText>
          {t('signIn.code')} <bdi>{interaction.userCode}</bdi>
        </MutedText>
        <a
          className={buttonClass('secondary')}
          href={interaction.url}
          target="_blank"
          rel="noreferrer noopener"
        >
          {t('signIn.open')}
        </a>
      </Stack>
    );
  return <pre className="qb-pre">{interaction.output}</pre>;
}
