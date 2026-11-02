import { Link } from 'react-router';
import type { BankResponse } from '../../../contracts/library.js';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  Grid,
  Heading,
  MutedText,
  Stack,
  Title,
} from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchBanks } from './api.js';
import { CreateBankCard } from './CreateBankCard.js';

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
  const steps = [
    t('library.empty.step1'),
    t('library.empty.step2'),
    t('library.empty.step3'),
    t('library.empty.step4'),
  ];
  return (
    <EmptyState
      title={t('library.empty.title')}
      description={t('library.empty.description')}
      steps={steps}
    />
  );
}

export function LibraryScreen() {
  const { t } = useI18n();
  const { state, reload } = useQuery(fetchBanks);
  return (
    <Stack>
      <Heading>{t('library.title')}</Heading>
      {state.status === 'loading' && <MutedText>{t('common.loading')}</MutedText>}
      {state.status === 'error' && <Alert tone="error">{t(state.error)}</Alert>}
      {state.status === 'ready' && state.data.banks.length === 0 && <LibraryEmpty />}
      {state.status === 'ready' && state.data.banks.length > 0 && (
        <Grid>
          {state.data.banks.map((bank) => (
            <BankCard key={bank.id} bank={bank} />
          ))}
        </Grid>
      )}
      <CreateBankCard onCreated={reload} />
    </Stack>
  );
}
