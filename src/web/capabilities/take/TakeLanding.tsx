import type { TakeLandingResponse } from '../../../contracts/take.js';
import {
  Alert,
  Button,
  Card,
  Heading,
  MutedText,
  Stack,
  Subtitle,
  TextField,
} from '../../design-system/index.js';
import { text, useSubmit } from '../../platform/forms/use-submit.js';
import { useI18n, type MessageKey } from '../../platform/i18n/i18n.js';
import { PolicyCard } from '../channels/PolicyCard.js';
import type { StartInput } from './api.js';

const CLOSED: Partial<Record<TakeLandingResponse['status'], MessageKey>> = {
  scheduled: 'take.status.scheduled',
  paused: 'take.status.paused',
  ended: 'take.status.ended',
  archived: 'take.status.ended',
};

/** Only the fields the share asks for; empty optional ones are left out. */
function inputOf(form: FormData): StartInput {
  const optional = (field: string) => {
    const value = text(form, field).trim();
    return value ? { [field]: value } : {};
  };
  return { name: text(form, 'name').trim(), ...optional('personId'), ...optional('code') };
}

type FieldError = (field: string) => string | undefined;

/** The id if the share asks for it, and the code if it has one. */
function AskedFields({
  audience,
  fieldError,
}: {
  audience: TakeLandingResponse['policy']['audience'];
  fieldError: FieldError;
}) {
  const { t } = useI18n();
  return (
    <>
      {audience.askId && (
        <TextField
          label={t('take.form.personId')}
          hint={t('take.form.personIdHint')}
          name="personId"
          required
          maxLength={50}
          error={fieldError('personId')}
        />
      )}
      {audience.access === 'code' && (
        <TextField
          label={t('take.form.code')}
          hint={t('take.form.codeHint')}
          name="code"
          required
          maxLength={32}
          autoComplete="off"
          error={fieldError('code')}
        />
      )}
    </>
  );
}

/** Name, the id if asked and the code if set; the server checks every one of them. */
function StartForm({
  landing,
  onStart,
}: {
  landing: TakeLandingResponse;
  onStart(input: StartInput): Promise<void>;
}) {
  const { t } = useI18n();
  const submit = useSubmit((form) => onStart(inputOf(form)));
  const fieldError: FieldError = (field) => {
    const key = submit.fieldErrors[field];
    return key && t(key);
  };
  return (
    <Card>
      <form className="qb-stack" onSubmit={submit.onSubmit} noValidate>
        <Subtitle>{t('take.form.title')}</Subtitle>
        <TextField
          label={t('take.form.name')}
          name="name"
          autoComplete="name"
          required
          minLength={2}
          maxLength={100}
          error={fieldError('name')}
        />
        <AskedFields audience={landing.policy.audience} fieldError={fieldError} />
        <MutedText>{t('take.form.notice')}</MutedText>
        {submit.error && <Alert tone="error">{t(submit.error)}</Alert>}
        <Button type="submit" busy={submit.busy}>
          {t('take.form.start')}
        </Button>
      </form>
    </Card>
  );
}

/** The link's first page: what this is, who runs it and its rules, then the start form. */
export function TakeLanding({
  landing,
  onStart,
}: {
  landing: TakeLandingResponse;
  onStart(input: StartInput): Promise<void>;
}) {
  const { t } = useI18n();
  const closed = CLOSED[landing.status];
  return (
    <Stack>
      <Heading>
        <bdi>{landing.name}</bdi>
      </Heading>
      <MutedText>
        {t(`take.kind.${landing.kind}`)} · {t('take.questions')} {landing.total}
      </MutedText>
      <PolicyCard kind={landing.kind} name={landing.name} policy={landing.policy} />
      {closed ? (
        <Alert tone="info">{t(closed)}</Alert>
      ) : (
        <StartForm landing={landing} onStart={onStart} />
      )}
    </Stack>
  );
}
