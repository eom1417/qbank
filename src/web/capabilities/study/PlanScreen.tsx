import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Alert,
  Button,
  buttonClass,
  Card,
  Checkbox,
  Heading,
  MutedText,
  Stack,
  Subtitle,
} from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchBanks } from '../library/api.js';
import { fetchDue, startStudy } from './api.js';
import { TopicsCard } from './TopicsCard.js';

/** Today's due questions with why, or what to study instead (FR-15-005, UAT-063). */
function DueCard({ bankIds }: { bankIds: string[] }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { state } = useQuery(useCallback(() => fetchDue(bankIds), [bankIds]));
  const start = useAction(async (count: number) => {
    const session = await startStudy({ bankIds }, 'due', Math.min(count, 200));
    void navigate(`/study/sessions/${session.id}`);
  });
  if (state.status !== 'ready') return null;
  const due = state.data;
  if (due.count === 0)
    return (
      <Alert tone="info">
        {t('plan.none')} {t('plan.alt.new')} {due.alternatives.new} · {t('plan.alt.weak')}{' '}
        {due.alternatives.weak}{' '}
        <Link className={buttonClass('secondary')} to="/study">
          {t('plan.alt.go')}
        </Link>
      </Alert>
    );
  return (
    <Card>
      <Stack>
        <Subtitle>
          {t('plan.due')} {due.count}
        </Subtitle>
        <Button busy={start.busy} onClick={() => void start.run(due.count)}>
          {t('plan.start')}
        </Button>
        {due.items.slice(0, 20).map((item) => (
          <Stack key={item.questionId}>
            <p dir="auto">{item.excerpt}</p>
            <MutedText>
              {t('plan.why')} {item.streak} · {t('plan.after')} {item.intervalDays}
            </MutedText>
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}

/** Today's reviews and chapters by need (UI-20, JY-13); always only a suggestion (FR-15-007). */
export function PlanScreen() {
  const { t } = useI18n();
  const banks = useQuery(useCallback(() => fetchBanks(), [])).state;
  const [chosen, setChosen] = useState<string[] | null>(null);
  const all = banks.status === 'ready' ? banks.data.banks.map((b) => b.id) : [];
  const bankIds = chosen ?? all;
  const toggle = (id: string) =>
    setChosen(bankIds.includes(id) ? bankIds.filter((b) => b !== id) : [...bankIds, id]);
  return (
    <Stack>
      <Heading>{t('plan.title')}</Heading>
      <MutedText>{t('plan.free')}</MutedText>
      <Card>
        <Stack>
          <MutedText>{t('plan.banks')}</MutedText>
          {banks.status === 'ready' &&
            banks.data.banks.map((b) => (
              <Checkbox
                key={b.id}
                label={b.name}
                checked={bankIds.includes(b.id)}
                onChange={() => toggle(b.id)}
              />
            ))}
        </Stack>
      </Card>
      {bankIds.length > 0 && (
        <>
          <DueCard key={bankIds.join()} bankIds={bankIds} />
          <TopicsCard key={`t${bankIds.join()}`} bankIds={bankIds} />
        </>
      )}
    </Stack>
  );
}
