import { useCallback, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { StudyKind } from '../../../contracts/study.js';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Heading,
  MutedText,
  NarrowColumn,
  SelectField,
  Stack,
  TextField,
} from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchBanks } from '../library/api.js';
import { startExam, startStudy } from './api.js';
import { ExamOptions, timingOf } from './ExamOptions.js';
import { SharesFields } from './SharesFields.js';
import { useStudySetup } from './use-study-setup.js';

const KINDS: StudyKind[] = ['smart_mix', 'random', 'new', 'weak', 'wrong', 'due', 'flagged'];

/** What is ready, and what to do when it is fewer than asked for (FR-12-001). */
function Availability({
  available,
  size,
  onUseAll,
}: {
  available: number | null;
  size: number;
  onUseAll(): void;
}) {
  const { t } = useI18n();
  if (available === null) return null;
  if (available === 0) return <Alert tone="info">{t('study.setup.none')}</Alert>;
  if (available >= size)
    return (
      <MutedText>
        {t('study.setup.available')} {available}
      </MutedText>
    );
  return (
    <Alert tone="info">
      {t('study.setup.notEnough')} {available}. {t('study.setup.widen')}{' '}
      <Button variant="secondary" onClick={onUseAll}>
        {t('study.setup.useAvailable')}
      </Button>
    </Alert>
  );
}

type Setup = ReturnType<typeof useStudySetup>;

/** The banks, kind, number and favourites of the session. */
function SetupFields({ setup }: { setup: Setup }) {
  const { t } = useI18n();
  const banks = useQuery(useCallback(() => fetchBanks(), [])).state;
  return (
    <>
      <Stack>
        <MutedText>{t('study.setup.banks')}</MutedText>
        {banks.status === 'ready' &&
          banks.data.banks.map((bank) => (
            <Checkbox
              key={bank.id}
              label={bank.name}
              checked={setup.bankIds.includes(bank.id)}
              onChange={() => setup.toggleBank(bank.id)}
            />
          ))}
      </Stack>
      <SelectField
        label={t('study.setup.kind')}
        value={setup.kind}
        options={KINDS.map((k) => ({ value: k, label: t(`study.kind.${k}`) }))}
        onChange={(e) => setup.setKind(e.target.value as StudyKind)}
      />
      <TextField
        label={t('study.setup.size')}
        type="number"
        min={1}
        max={200}
        value={setup.size}
        onChange={(e) => setup.setSize(Number(e.target.value))}
      />
      <Checkbox
        label={t('study.setup.favorites')}
        checked={setup.favoritesOnly}
        onChange={(e) => setup.setFavoritesOnly(e.target.checked)}
      />
    </>
  );
}

/** Starts the chosen session and opens it: the Tutor screen, or the exam. */
function useStart(setup: Setup) {
  const navigate = useNavigate();
  return useAction(async () => {
    if (setup.mode === 'exam') {
      const exam = await startExam(
        setup.scope,
        setup.kind,
        setup.size,
        timingOf(setup.timing, setup.amount),
      );
      return void navigate(`/exam/sessions/${exam.id}`);
    }
    const session = await startStudy(setup.scope, setup.kind, setup.size, setup.shares);
    void navigate(`/study/sessions/${session.id}`);
  });
}

/** Tutor (answers as you go) or exam (answers at the end). */
function ModeField({ setup }: { setup: Setup }) {
  const { t } = useI18n();
  const modes = [
    { value: 'tutor', label: t('exam.mode.tutor') },
    { value: 'exam', label: t('exam.mode.exam') },
  ];
  return (
    <SelectField
      label={t('exam.mode')}
      value={setup.mode}
      options={modes}
      onChange={(e) => setup.setMode(e.target.value as 'tutor' | 'exam')}
    />
  );
}

/** Choosing banks, kind and number, then starting (UI-13, JY-07). */
export function StudySetupScreen() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const setup = useStudySetup(params.get('bank'));
  const start = useStart(setup);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void start.run();
  };
  const ready = setup.available !== null && setup.available >= setup.size && setup.size > 0;
  return (
    <NarrowColumn>
      <Heading>{t('study.setup.title')}</Heading>
      <Card>
        <form className="qb-stack" onSubmit={submit} noValidate>
          <ModeField setup={setup} />
          <SetupFields setup={setup} />
          {setup.kind === 'smart_mix' && (
            <SharesFields shares={setup.shares} groups={setup.groups} onChange={setup.setShares} />
          )}
          {setup.mode === 'exam' && (
            <ExamOptions
              timing={setup.timing}
              amount={setup.amount}
              onTiming={setup.setTiming}
              onAmount={setup.setAmount}
            />
          )}
          <Availability
            available={setup.available}
            size={setup.size}
            onUseAll={() => setup.setSize(setup.available ?? 1)}
          />
          {start.error && <Alert tone="error">{t(start.error)}</Alert>}
          <Button type="submit" busy={start.busy} disabled={!ready}>
            {t(setup.mode === 'exam' ? 'exam.start' : 'study.setup.start')}
          </Button>
        </form>
      </Card>
    </NarrowColumn>
  );
}
