import { useCallback } from 'react';
import type { QuestionResponse } from '../../../contracts/questions.js';
import { Checkbox, MutedText, SelectField, Stack, Subtitle } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchTags, fetchTaxonomy } from '../library/taxonomy-api.js';
import type { Classification } from './classification-state.js';

const LEVELS = ['1', '2', '3', '4', '5'] as const;

/** How hard, as the owner sets it or as results say (always which one, FR-11-005). */
function DifficultyField({
  question,
  state,
}: {
  question: QuestionResponse;
  state: Classification;
}) {
  const { t } = useI18n();
  const { kind, value } = question.difficulty;
  return (
    <Stack>
      <SelectField
        label={t('editor.difficulty')}
        value={state.difficulty}
        onChange={(event) => state.setDifficulty(event.target.value)}
        options={[
          { value: '', label: t('editor.difficulty.none') },
          ...LEVELS.map((level) => ({ value: level, label: t(`editor.difficulty.${level}`) })),
        ]}
      />
      {kind === 'inferred' && value !== null && (
        <MutedText>
          {t('editor.difficulty.inferred')}{' '}
          {t(`editor.difficulty.${value}` as 'editor.difficulty.1')}
        </MutedText>
      )}
    </Stack>
  );
}

/** Chapter, topic and tags of the question, from the bank's and the account's own names. */
export function ClassificationFields({
  question,
  state,
}: {
  question: QuestionResponse;
  state: Classification;
}) {
  const { t } = useI18n();
  const taxonomy = useQuery(
    useCallback(() => fetchTaxonomy(question.bankId), [question.bankId]),
  ).state;
  const tags = useQuery(fetchTags).state;
  const chapters = taxonomy.status === 'ready' ? taxonomy.data.chapters : [];
  const topics = chapters.find((c) => c.id === state.chapterId)?.topics ?? [];
  const none = { value: '', label: t('editor.place.none') };
  return (
    <Stack>
      <Subtitle>{t('editor.place.title')}</Subtitle>
      <SelectField
        label={t('editor.chapter')}
        value={state.chapterId}
        onChange={(event) => state.setChapterId(event.target.value)}
        options={[none, ...chapters.map((c) => ({ value: c.id, label: c.name }))]}
      />
      <SelectField
        label={t('editor.topic')}
        value={state.topicId}
        disabled={topics.length === 0}
        onChange={(event) => state.setTopicId(event.target.value)}
        options={[none, ...topics.map((topic) => ({ value: topic.id, label: topic.name }))]}
      />
      {tags.status === 'ready' && tags.data.tags.length > 0 && (
        <fieldset className="qb-choices">
          <legend className="qb-field__label">{t('editor.tags')}</legend>
          {tags.data.tags.map((tag) => (
            <Checkbox
              key={tag.id}
              label={tag.name}
              checked={state.tagIds.includes(tag.id)}
              onChange={() => state.toggleTag(tag.id)}
            />
          ))}
        </fieldset>
      )}
      <DifficultyField question={question} state={state} />
    </Stack>
  );
}
