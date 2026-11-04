import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  Alert,
  buttonClass,
  Card,
  Checkbox,
  Heading,
  MutedText,
  Stack,
} from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchTaxonomy } from '../library/taxonomy-api.js';
import { exportUrl, fetchExportPreview } from './api.js';

const KNOWN = [
  'ai_sign_ins_and_keys',
  'original_files',
  'attempt_history',
  'study_reports',
] as const;

/** What the chosen export holds and never holds, then the download (UI-26, FR-18-006). */
function Preview({ bankId, chapterIds }: { bankId: string; chapterIds: string[] }) {
  const { t } = useI18n();
  const { state } = useQuery(
    useCallback(() => fetchExportPreview(bankId, chapterIds), [bankId, chapterIds]),
  );
  if (state.status === 'error') return <Alert tone="error">{t(state.error)}</Alert>;
  if (state.status !== 'ready') return null;
  const p = state.data;
  const notIncluded = p.notIncluded.filter((n): n is (typeof KNOWN)[number] =>
    (KNOWN as readonly string[]).includes(n),
  );
  return (
    <Card>
      <Stack>
        <MutedText>
          {t('export.holds')} {p.questions} {t('export.questions')} · {p.pictures}{' '}
          {t('export.pictures')} · {p.notes} {t('export.notes')} · {p.chapters}{' '}
          {t('export.chaptersCount')} · {p.sources} {t('export.sources')}
        </MutedText>
        <MutedText>
          {t('export.notIncluded')} {notIncluded.map((n) => t(`export.not.${n}`)).join('، ')}
        </MutedText>
        <a className={buttonClass()} href={exportUrl(bankId, chapterIds)} download>
          {t('export.download')}
        </a>
      </Stack>
    </Card>
  );
}

/** Exporting a bank, all of it or some chapters (UI-26, FR-18-001, FR-18-003). */
export function ExportScreen() {
  const { t } = useI18n();
  const bankId = useParams()['bankId'] ?? '';
  const taxonomy = useQuery(useCallback(() => fetchTaxonomy(bankId), [bankId])).state;
  const [chapterIds, setChapterIds] = useState<string[]>([]);
  const toggle = (id: string) =>
    setChapterIds((all) => (all.includes(id) ? all.filter((c) => c !== id) : [...all, id]));
  return (
    <Stack>
      <Link to={`/banks/${bankId}`}>{t('review.back')}</Link>
      <Heading>{t('export.title')}</Heading>
      {taxonomy.status === 'ready' && taxonomy.data.chapters.length > 0 && (
        <Card>
          <Stack>
            <MutedText>{t('export.chapters')}</MutedText>
            {taxonomy.data.chapters.map((c) => (
              <Checkbox
                key={c.id}
                label={c.name}
                checked={chapterIds.includes(c.id)}
                onChange={() => toggle(c.id)}
              />
            ))}
          </Stack>
        </Card>
      )}
      <Preview key={chapterIds.join()} bankId={bankId} chapterIds={chapterIds} />
    </Stack>
  );
}
