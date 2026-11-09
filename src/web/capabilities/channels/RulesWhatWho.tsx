import { Checkbox, MutedText, TextField } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { withAccess } from './policy-form.js';
import { RuleChoice, RuleNumber } from './RuleFields.js';
import { RuleGroup, type RuleProps } from './RuleGroup.js';
import { PASS_PERCENT } from './rule-options.js';

/** 1. What: the end of an agent's round, an exam's reservation and pass mark. */
export function RulesWhat({ draft, errors }: RuleProps) {
  const { t } = useI18n();
  const { content } = draft.policy;
  return (
    <RuleGroup legend={t('sharing.form.q1')}>
      {draft.kind === 'agent' && (
        <RuleChoice
          label={t('sharing.form.whenDone')}
          value={content.whenDone}
          options={[
            { value: 'restart', label: t('sharing.card.whenDone.restart') },
            { value: 'stop', label: t('sharing.card.whenDone.stop') },
          ]}
          onChange={(whenDone) => draft.set('content', { whenDone })}
          error={errors['content.whenDone']}
        />
      )}
      {draft.kind === 'exam' && (
        <>
          <Checkbox
            label={t('sharing.form.reserve')}
            checked={content.reserve}
            onChange={(e) => draft.set('content', { reserve: e.target.checked })}
          />
          <RuleNumber
            label={t('sharing.form.pass')}
            value={content.passPercent}
            options={PASS_PERCENT}
            format={(n) => `${n}%`}
            noneLabel={t('sharing.form.none')}
            onChange={(passPercent) => draft.set('content', { passPercent })}
          />
        </>
      )}
    </RuleGroup>
  );
}

/** Anyone with the link, or the link and a code the owner gives with it. */
function AccessFields({ draft, errors }: RuleProps) {
  const { t } = useI18n();
  const { audience } = draft.policy;
  const code = audience.access === 'code' ? audience.code : '';
  const setAccess = (access: 'open' | 'code', value = code) =>
    draft.setPolicy((p) => withAccess(p, access, value));
  return (
    <>
      <RuleChoice
        label={t('sharing.form.access')}
        value={audience.access === 'code' ? 'code' : 'open'}
        options={[
          { value: 'open', label: t('sharing.form.access.open') },
          { value: 'code', label: t('sharing.form.access.code') },
        ]}
        onChange={(access) => setAccess(access)}
        error={errors['audience.access']}
      />
      {audience.access === 'code' && (
        <TextField
          label={t('sharing.form.code')}
          hint={t('sharing.form.code.hint')}
          value={code}
          required
          minLength={4}
          maxLength={32}
          autoComplete="off"
          onChange={(e) => setAccess('code', e.target.value)}
          error={errors['audience.code']}
        />
      )}
    </>
  );
}

/** 2. Who: a people's share opens by link or by link and code, and may ask for an ID. */
export function RulesWho({ draft, errors }: RuleProps) {
  const { t } = useI18n();
  const { audience, presenter } = draft.policy;
  if (audience.access === 'key')
    return (
      <RuleGroup legend={t('sharing.form.q2')}>
        <MutedText>{t('sharing.card.who.key')}</MutedText>
      </RuleGroup>
    );
  return (
    <RuleGroup legend={t('sharing.form.q2')}>
      <TextField
        label={t('sharing.form.presenter')}
        value={presenter}
        maxLength={100}
        onChange={(e) => draft.setPolicy((p) => ({ ...p, presenter: e.target.value }))}
      />
      <AccessFields draft={draft} errors={errors} />
      <Checkbox
        label={t('sharing.form.askId')}
        checked={audience.askId}
        onChange={(e) =>
          draft.setPolicy((p) => ({ ...p, audience: { ...audience, askId: e.target.checked } }))
        }
      />
    </RuleGroup>
  );
}
