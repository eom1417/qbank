import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { SearchQuery, SearchResponse } from '../../../contracts/analytics.js';
import {
  Alert,
  Button,
  buttonClass,
  Card,
  Checkbox,
  EmptyState,
  Heading,
  MutedText,
  Row,
  SelectField,
  Stack,
  TextField,
} from '../../design-system/index.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { BankSelect } from '../library/BankSelect.js';
import { searchQuestions } from './api.js';

const STATUSES = ['', 'eligible', 'needs_review', 'detected', 'excluded'] as const;
const REVIEWS = ['', 'wrong', 'unanswered', 'due', 'deferred', 'no_answer'] as const;

type Change = (patch: Partial<SearchQuery>) => void;

/** Narrowing by bank, by where the question stands, and by the owner's answers. */
function SearchSelects({ query, set }: { query: SearchQuery; set: Change }) {
  const { t } = useI18n();
  const statuses = STATUSES.map((s) => ({
    value: s,
    label: s ? t(`editor.status.${s}`) : t('search.status.any'),
  }));
  const reviews = REVIEWS.map((r) => ({
    value: r,
    label: t(r ? `search.review.${r}` : 'search.review.any'),
  }));
  return (
    <Row>
      <BankSelect
        value={query.bankId ?? ''}
        onChange={(bankId) => set({ bankId: bankId || undefined })}
      />
      <SelectField
        label={t('search.status')}
        value={query.status ?? ''}
        options={statuses}
        onChange={(e) => set({ status: (e.target.value || undefined) as SearchQuery['status'] })}
      />
      <SelectField
        label={t('search.review')}
        value={query.review ?? ''}
        options={reviews}
        onChange={(e) => set({ review: (e.target.value || undefined) as SearchQuery['review'] })}
      />
    </Row>
  );
}

/** The search form: words, bank, state, answers and marks (FR-17-001, FR-17-006). */
function SearchForm({ query, onChange }: { query: SearchQuery; onChange(q: SearchQuery): void }) {
  const { t } = useI18n();
  const set: Change = (patch) => onChange({ ...query, ...patch });
  return (
    <>
      <TextField
        label={t('search.q')}
        dir="auto"
        value={query.q ?? ''}
        onChange={(e) => set({ q: e.target.value })}
      />
      <SearchSelects query={query} set={set} />
      <Row>
        <Checkbox
          label={t('search.flagged')}
          checked={query.flagged === 'true'}
          onChange={(e) => set({ flagged: e.target.checked ? 'true' : undefined })}
        />
        <Checkbox
          label={t('search.favorite')}
          checked={query.favorite === 'true'}
          onChange={(e) => set({ favorite: e.target.checked ? 'true' : undefined })}
        />
      </Row>
    </>
  );
}

function Results({ found, onClear }: { found: SearchResponse; onClear(): void }) {
  const { t } = useI18n();
  if (found.total === 0)
    return (
      <EmptyState
        title={t('search.none')}
        description={t('search.q')}
        action={
          <Button variant="secondary" onClick={onClear}>
            {t('search.clear')}
          </Button>
        }
      />
    );
  return (
    <Stack>
      <MutedText>
        {t('search.count')} {found.total}
      </MutedText>
      {found.results.map((r) => (
        <Card key={r.id}>
          <Row>
            <p dir="auto">{r.excerpt}</p>
            <Link className={buttonClass('secondary')} to={`/questions/${r.id}/read`}>
              {t('search.read')}
            </Link>
            <Link className={buttonClass('ghost')} to={`/questions/${r.id}`}>
              {t('search.edit')}
            </Link>
          </Row>
        </Card>
      ))}
    </Stack>
  );
}

/** Searching the owner's questions (UI-22, JY-18): results open for reading, never as an attempt. */
export function SearchScreen() {
  const { t } = useI18n();
  const [query, setQuery] = useState<SearchQuery>({});
  const [found, setFound] = useState<SearchResponse | null>(null);
  const run = useAction(async (q: SearchQuery) => setFound(await searchQuestions(q)));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run.run(query);
  };
  const clear = () => {
    setQuery({});
    void run.run({});
  };
  return (
    <Stack>
      <Heading>{t('search.title')}</Heading>
      <Card>
        <form className="qb-stack" onSubmit={submit} noValidate>
          <SearchForm query={query} onChange={setQuery} />
          <Button type="submit" busy={run.busy}>
            {t('search.submit')}
          </Button>
        </form>
      </Card>
      {run.error && <Alert tone="error">{t(run.error)}</Alert>}
      {found && <Results found={found} onClear={clear} />}
    </Stack>
  );
}
