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
import { startStudy } from './api.js';
import { useStudySetup } from './use-study-setup.js';

const KINDS: StudyKind[] = ['random', 'new', 'wrong', 'due', 'flagged'];

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

/** Choosing banks, kind and number, then starting (UI-13, JY-07). */
export function StudySetupScreen() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setup = useStudySetup(params.get('bank'));
  const start = useAction(async () => {
    const session = await startStudy(setup.scope, setup.kind, setup.size);
    void navigate(`/study/sessions/${session.id}`);
  });
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
          <SetupFields setup={setup} />
          <Availability
            available={setup.available}
            size={setup.size}
            onUseAll={() => setup.setSize(setup.available ?? 1)}
          />
          {start.error && <Alert tone="error">{t(start.error)}</Alert>}
          <Button type="submit" busy={start.busy} disabled={!ready}>
            {t('study.setup.start')}
          </Button>
        </form>
      </Card>
    </NarrowColumn>
  );
}
