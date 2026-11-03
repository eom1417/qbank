import { Link } from 'react-router';
import type { SourceListResponse } from '../../../contracts/sources.js';
import { Alert, Badge, ConfirmButton, MutedText, Row } from '../../design-system/index.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { deleteOriginal, FINISHED_STAGES } from './api.js';

interface SourceItemProps {
  source: SourceListResponse['sources'][number];
  onChange(): void;
}

/** One source: its latest import, real counts, and deleting its original (FR-19-001). */
export function SourceItem({ source, onChange }: SourceItemProps) {
  const { t } = useI18n();
  const remove = useAction(async () => {
    await deleteOriginal(source.id);
    onChange();
  });
  const finished = FINISHED_STAGES.has(source.latestImport.stage);
  return (
    <li className="qb-list__item">
      <Row>
        <Link className="qb-grow" to={`/imports/${source.latestImport.id}`}>
          <bdi>{source.fileName}</bdi>
        </Link>
        <Badge>{t(`import.stage.${source.latestImport.stage}`)}</Badge>
      </Row>
      <MutedText>
        {t('source.pages')}: {source.pageFrom}–{source.pageTo} · {t('source.questions')}:{' '}
        {source.questions.total} · {t('source.review')}: {source.questions.needsReview}
      </MutedText>
      {!source.hasOriginal && <MutedText>{t('source.original.deleted')}</MutedText>}
      {source.hasOriginal && finished && (
        <ConfirmButton
          label={t('source.original.delete')}
          confirmLabel={t('source.original.confirmDelete')}
          busy={remove.busy}
          onConfirm={() => void remove.run()}
        />
      )}
      {remove.error && <Alert tone="error">{t(remove.error)}</Alert>}
    </li>
  );
}
