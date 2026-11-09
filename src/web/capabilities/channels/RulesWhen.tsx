import { TextField } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fill } from './policy-sentences.js';
import { fromLocalInput, toLocalInput } from './policy-form.js';
import { RuleChoice, RuleNumber } from './RuleFields.js';
import { RuleGroup, type RuleProps } from './RuleGroup.js';
import { ATTEMPTS, BATCHES_PER_DAY, DURATION_MINUTES } from './rule-options.js';

/** An exam's clock and its way through the questions. */
function ExamPace({ draft }: Pick<RuleProps, 'draft'>) {
  const { t } = useI18n();
  const { durationSeconds, navigation } = draft.policy.limits;
  return (
    <>
      <RuleNumber
        label={t('sharing.form.duration')}
        value={durationSeconds === null ? null : Math.round(durationSeconds / 60)}
        options={DURATION_MINUTES}
        format={(n) => fill(t('sharing.form.minutes'), { n })}
        noneLabel={t('sharing.card.duration.none')}
        onChange={(m) => draft.set('limits', { durationSeconds: m === null ? null : m * 60 })}
      />
      <RuleChoice
        label={t('sharing.form.navigation')}
        value={navigation}
        options={[
          { value: 'free', label: t('sharing.form.navigation.free') },
          { value: 'forward', label: t('sharing.form.navigation.forward') },
        ]}
        onChange={(value) => draft.set('limits', { navigation: value })}
      />
    </>
  );
}

/** How much one person, or the agent each day, may take. */
function Amounts({ draft }: Pick<RuleProps, 'draft'>) {
  const { t } = useI18n();
  const { attemptsPerPerson, batchesPerDay } = draft.policy.limits;
  if (draft.kind === 'agent')
    return (
      <RuleNumber
        label={t('sharing.form.batches')}
        value={batchesPerDay}
        options={BATCHES_PER_DAY}
        format={String}
        noneLabel={t('sharing.form.unlimited')}
        onChange={(n) => draft.set('limits', { batchesPerDay: n })}
      />
    );
  return (
    <RuleNumber
      label={t('sharing.form.attempts')}
      value={attemptsPerPerson}
      options={ATTEMPTS}
      format={String}
      noneLabel={t('sharing.form.unlimited')}
      onChange={(n) => draft.set('limits', { attemptsPerPerson: n })}
    />
  );
}

/** 3. When, and how much: the dates, then the amounts and an exam's pace. */
export function RulesWhen({ draft, errors }: RuleProps) {
  const { t } = useI18n();
  const { startsAt, endsAt } = draft.policy.limits;
  return (
    <RuleGroup legend={t('sharing.form.q3')}>
      <TextField
        label={t('sharing.form.startsAt')}
        type="datetime-local"
        value={toLocalInput(startsAt)}
        onChange={(e) => draft.set('limits', { startsAt: fromLocalInput(e.target.value) })}
        error={errors['limits.startsAt']}
      />
      <TextField
        label={t('sharing.form.endsAt')}
        type="datetime-local"
        value={toLocalInput(endsAt)}
        onChange={(e) => draft.set('limits', { endsAt: fromLocalInput(e.target.value) })}
        error={errors['limits.endsAt']}
      />
      <Amounts draft={draft} />
      {draft.kind === 'exam' && <ExamPace draft={draft} />}
    </RuleGroup>
  );
}
