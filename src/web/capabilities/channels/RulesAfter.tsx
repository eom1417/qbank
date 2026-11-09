import type { RevealLevel } from '../../../contracts/sharing.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fill, levelKey } from './policy-sentences.js';
import { RuleChoice, RuleNumber } from './RuleFields.js';
import { RuleGroup, type RuleProps } from './RuleGroup.js';
import { RETENTION_DAYS, REVEAL_HOURS } from './rule-options.js';

const PEOPLE_LEVELS: readonly RevealLevel[] = ['none', 'score', 'answers', 'explained'];
const AGENT_LEVELS: readonly RevealLevel[] = ['answers', 'explained'];

/** 4. What receivers see after, and when. */
export function RulesReveal({ draft, errors }: RuleProps) {
  const { t } = useI18n();
  const { level, when, hours } = draft.policy.reveal;
  const agent = draft.kind === 'agent';
  const levels = (agent ? AGENT_LEVELS : PEOPLE_LEVELS).map((value) => ({
    value,
    label: t(levelKey(draft.kind, value)),
  }));
  return (
    <RuleGroup legend={t('sharing.form.q4')}>
      <RuleChoice
        label={t('sharing.form.level')}
        value={level}
        options={levels}
        onChange={(value) => draft.set('reveal', { level: value })}
        error={errors['reveal.level']}
      />
      <RuleChoice
        label={t('sharing.form.when')}
        value={when}
        options={(['immediately', 'after_hours', 'after_end'] as const).map((value) => ({
          value,
          label: t(`sharing.form.when.${value}`),
        }))}
        onChange={(value) =>
          draft.set('reveal', { when: value, hours: value === 'after_hours' ? (hours ?? 6) : null })
        }
        error={errors['reveal.when']}
      />
      {when === 'after_hours' && (
        <RuleNumber
          label={t('sharing.form.hours')}
          value={hours}
          options={REVEAL_HOURS}
          format={String}
          noneLabel={t('sharing.form.none')}
          onChange={(n) => draft.set('reveal', { hours: n })}
          error={errors['reveal.hours']}
        />
      )}
    </RuleGroup>
  );
}

/** 5. What the owner keeps: names or not, and for how long. */
export function RulesRecords({ draft }: Pick<RuleProps, 'draft'>) {
  const { t } = useI18n();
  const { identify, retentionDays } = draft.policy.records;
  return (
    <RuleGroup legend={t('sharing.form.q5')}>
      <RuleChoice
        label={t('sharing.form.identify')}
        value={identify}
        options={[
          { value: 'named', label: t('sharing.form.identify.named') },
          { value: 'anonymous', label: t('sharing.form.identify.anonymous') },
        ]}
        onChange={(value) => draft.set('records', { identify: value })}
      />
      <RuleNumber
        label={t('sharing.form.retention')}
        value={retentionDays}
        options={RETENTION_DAYS}
        format={(n) => fill(t('sharing.form.days'), { n })}
        noneLabel={t('sharing.form.none')}
        onChange={(n) => draft.set('records', { retentionDays: n ?? 365 })}
      />
    </RuleGroup>
  );
}
