import { useState } from 'react';
import type { TakeStateResponse } from '../../../contracts/take.js';
import { Button, Card, Heading, MutedText, Stack } from '../../design-system/index.js';
import { useI18n, type MessageKey } from '../../platform/i18n/i18n.js';

/** The rules this attempt runs under, from what the server allowed: nothing is assumed. */
function rulesOf(state: TakeStateResponse): MessageKey[] {
  const { allowed } = state;
  const timed = state.secondsLeft !== null;
  const rules: MessageKey[] = [
    'take.rules.saving',
    allowed.navigation === 'free' ? 'take.rules.free' : 'take.rules.forward',
    timed ? 'take.rules.timed' : 'take.rules.untimed',
  ];
  if (allowed.flag) rules.push('take.rules.flag');
  rules.push(allowed.feedbackEachQuestion ? 'take.rules.feedback' : 'take.rules.noFeedback');
  rules.push('take.rules.result');
  return rules;
}

/** Who manages this and its rules, in short, with the full rules a tap away. */
export function TakeBanner({ state }: { state: TakeStateResponse }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const short = [
    t(`take.kind.${state.kind}`),
    t(`take.rules.short.${state.allowed.navigation}`),
    t(state.secondsLeft === null ? 'take.rules.short.untimed' : 'take.rules.short.timed'),
  ];
  return (
    <Card>
      <Stack>
        <Heading>
          <bdi>{state.name}</bdi>
        </Heading>
        <MutedText>
          {state.presenter ? (
            <>
              {t('take.banner.by')} <bdi>{state.presenter}</bdi>
            </>
          ) : (
            t('take.banner.byUnknown')
          )}
        </MutedText>
        <MutedText>{short.join(' · ')}</MutedText>
        <Button variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
          {t(open ? 'take.rules.hide' : 'take.rules.show')}
        </Button>
        {open && (
          <ul className="qb-steps">
            {rulesOf(state).map((rule) => (
              <li key={rule}>{t(rule)}</li>
            ))}
          </ul>
        )}
      </Stack>
    </Card>
  );
}
