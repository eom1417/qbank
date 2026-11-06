import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import type { BankListFilter, BankResponse } from '../../../contracts/library.js';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Grid,
  Heading,
  MutedText,
  Row,
  SelectField,
  Stack,
  TextField,
  Title,
} from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchBanks } from './api.js';
import { CreateBankCard } from './CreateBankCard.js';
import { SampleBankCard } from './SampleBankCard.js';
import { lastStudiedOf, visibleBanks, type BankSort } from './library-view.js';
import { fetchHistory } from '../analytics/api.js';

type Show = BankListFilter['archived'];

function BankCard({ bank }: { bank: BankResponse }) {
  const { t } = useI18n();
  return (
    <Card>
      <Title>{bank.name}</Title>
      {bank.subject && <MutedText>{bank.subject}</MutedText>}
      {bank.archived && <Badge>{t('library.archived')}</Badge>}
      <Link to={`/banks/${bank.id}`}>{t('library.open')}</Link>
    </Card>
  );
}

function LibraryEmpty() {
  const { t } = useI18n();
  const steps = (
    [
      'library.empty.step1',
      'library.empty.step2',
      'library.empty.step3',
      'library.empty.step4',
    ] as const
  ).map((key) => t(key));
  return (
    <EmptyState
      title={t('library.empty.title')}
      description={t('library.empty.description')}
      steps={steps}
    />
  );
}

interface ToolbarProps {
  query: string;
  sort: BankSort;
  show: Show;
  onChange(next: { query?: string; sort?: BankSort; show?: Show }): void;
}

function LibraryToolbar({ query, sort, show, onChange }: ToolbarProps) {
  const { t } = useI18n();
  const sorts = (['updated', 'studied', 'created', 'name'] as const).map((value) => ({
    value,
    label: t(`library.sort.${value}`),
  }));
  const shows = (['exclude', 'only', 'include'] as const).map((value) => ({
    value,
    label: t(`library.show.${value}`),
  }));
  return (
    <Row>
      <TextField
        type="search"
        value={query}
        label={t('library.search')}
        onChange={(e) => onChange({ query: e.target.value })}
      />
      <SelectField
        label={t('library.sort')}
        options={sorts}
        value={sort}
        onChange={(e) => onChange({ sort: e.target.value as BankSort })}
      />
      <SelectField
        label={t('library.show')}
        options={shows}
        value={show}
        onChange={(e) => onChange({ show: e.target.value as Show })}
      />
    </Row>
  );
}

function BankResults({
  banks,
  query,
  onClear,
}: {
  banks: BankResponse[];
  query: string;
  onClear(): void;
}) {
  const { t } = useI18n();
  if (banks.length > 0) {
    return (
      <Grid>
        {banks.map((bank) => (
          <BankCard key={bank.id} bank={bank} />
        ))}
      </Grid>
    );
  }
  if (!query) return null;
  return (
    <Row>
      <MutedText>{t('library.noMatch')}</MutedText>
      <Button variant="ghost" onClick={onClear}>
        {t('library.clearSearch')}
      </Button>
    </Row>
  );
}

/** The library (UI-03, UI-04): search, sort, archived filter, and guidance when empty. */
export function LibraryScreen() {
  const { t } = useI18n();
  const [view, setView] = useState({
    query: '',
    sort: 'updated' as BankSort,
    show: 'exclude' as Show,
  });
  const load = useCallback(() => fetchBanks(view.show), [view.show]);
  const { state, reload } = useQuery(load);
  const history = useQuery(useCallback(() => fetchHistory('', ''), [])).state;
  const studied = lastStudiedOf(history.status === 'ready' ? history.data.sessions : []);
  const banks = state.status === 'ready' ? state.data.banks : [];
  const isNewLibrary = state.status === 'ready' && banks.length === 0 && view.show === 'exclude';
  return (
    <Stack>
      <Heading>{t('library.title')}</Heading>
      {state.status === 'loading' && <MutedText>{t('common.loading')}</MutedText>}
      {state.status === 'error' && <Alert tone="error">{t(state.error)}</Alert>}
      {isNewLibrary && <LibraryEmpty />}
      {isNewLibrary && <SampleBankCard />}
      {!isNewLibrary && (
        <LibraryToolbar {...view} onChange={(next) => setView({ ...view, ...next })} />
      )}
      <BankResults
        banks={visibleBanks(banks, view.query, view.sort, studied)}
        query={view.query}
        onClear={() => setView({ ...view, query: '' })}
      />
      <CreateBankCard onCreated={reload} />
    </Stack>
  );
}
