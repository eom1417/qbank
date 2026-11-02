import { Alert, Card, MutedText, Title } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { createTag, deleteNamed, fetchTags, renameNamed } from './taxonomy-api.js';
import { AddNameForm, NamedItemRow } from './NamedItems.js';

/** Account-wide tags (FR-11-004). */
export function TagsCard() {
  const { t } = useI18n();
  const { state, reload } = useQuery(fetchTags);
  const after = (action: Promise<unknown>) => action.then(reload);
  return (
    <Card>
      <Title>{t('tags.title')}</Title>
      <MutedText>{t('tags.intro')}</MutedText>
      {state.status === 'error' && <Alert tone="error">{t(state.error)}</Alert>}
      {state.status === 'ready' && state.data.tags.length === 0 && (
        <MutedText>{t('tags.empty')}</MutedText>
      )}
      {state.status === 'ready' && (
        <ul className="qb-list">
          {state.data.tags.map((tag) => (
            <li key={tag.id} className="qb-list__item">
              <NamedItemRow
                name={tag.name}
                onRename={(name) => after(renameNamed('tags', tag.id, name))}
                onDelete={() => after(deleteNamed('tags', tag.id))}
              />
            </li>
          ))}
        </ul>
      )}
      <AddNameForm
        label={t('tags.name')}
        submitLabel={t('tags.add')}
        onAdd={(name) => after(createTag(name))}
      />
    </Card>
  );
}
