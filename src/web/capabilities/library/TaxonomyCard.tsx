import { useCallback } from 'react';
import type { ChapterResponse } from '../../../contracts/library.js';
import { Alert, Card, MutedText, Subtitle, Title } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { addChapter, addTopic, deleteNamed, fetchTaxonomy, renameNamed } from './taxonomy-api.js';
import { AddNameForm, NamedItemRow } from './NamedItems.js';

function ChapterItem({ chapter, onChange }: { chapter: ChapterResponse; onChange(): void }) {
  const { t } = useI18n();
  const after = (action: Promise<unknown>) => action.then(onChange);
  return (
    <li className="qb-list__item">
      <NamedItemRow
        name={chapter.name}
        onRename={(name) => after(renameNamed('chapters', chapter.id, name))}
        onDelete={() => after(deleteNamed('chapters', chapter.id))}
      />
      <ul className="qb-list qb-indent">
        {chapter.topics.map((topic) => (
          <li key={topic.id}>
            <NamedItemRow
              name={topic.name}
              onRename={(name) => after(renameNamed('topics', topic.id, name))}
              onDelete={() => after(deleteNamed('topics', topic.id))}
            />
          </li>
        ))}
      </ul>
      <AddNameForm
        label={t('taxonomy.topicName')}
        submitLabel={t('taxonomy.addTopic')}
        onAdd={(name) => after(addTopic(chapter.id, name))}
      />
    </li>
  );
}

/** Chapters and topics of one bank (FR-03-003). */
export function TaxonomyCard({ bankId }: { bankId: string }) {
  const { t } = useI18n();
  const load = useCallback(() => fetchTaxonomy(bankId), [bankId]);
  const { state, reload } = useQuery(load);
  return (
    <Card>
      <Title>{t('taxonomy.title')}</Title>
      <MutedText>{t('taxonomy.intro')}</MutedText>
      <MutedText>{t('taxonomy.deleteChapterHint')}</MutedText>
      {state.status === 'error' && <Alert tone="error">{t(state.error)}</Alert>}
      {state.status === 'ready' && state.data.chapters.length === 0 && (
        <Subtitle>{t('taxonomy.empty')}</Subtitle>
      )}
      {state.status === 'ready' && (
        <ul className="qb-list">
          {state.data.chapters.map((chapter) => (
            <ChapterItem key={chapter.id} chapter={chapter} onChange={reload} />
          ))}
        </ul>
      )}
      <AddNameForm
        label={t('taxonomy.chapterName')}
        submitLabel={t('taxonomy.addChapter')}
        onAdd={(name) => addChapter(bankId, name).then(reload)}
      />
    </Card>
  );
}
