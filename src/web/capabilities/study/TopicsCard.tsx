import { useCallback } from 'react';
import type { TopicsResponse } from '../../../contracts/study.js';
import { Card, MutedText, Stack, Subtitle } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchTaxonomy } from '../library/taxonomy-api.js';
import { fetchTopics } from './api.js';

/** Chapter names of the chosen banks, by id. */
function useChapterNames(bankIds: readonly string[]) {
  const load = useCallback(async () => {
    const lists = await Promise.all(bankIds.map((id) => fetchTaxonomy(id)));
    return new Map(lists.flatMap((l) => l.chapters.map((c) => [c.id, c.name] as const)));
  }, [bankIds]);
  return useQuery(load).state;
}

type Topic = TopicsResponse['topics'][number];

/** Chapters by need (FR-15-006): mastery from consistency, small samples said plainly. */
export function TopicsCard({ bankIds }: { bankIds: string[] }) {
  const { t } = useI18n();
  const { state } = useQuery(useCallback(() => fetchTopics(bankIds), [bankIds]));
  const names = useChapterNames(bankIds);
  if (state.status !== 'ready' || state.data.topics.length === 0) return null;
  const nameOf = (topic: Topic) =>
    (topic.chapterId && names.status === 'ready' && names.data.get(topic.chapterId)) ||
    t('plan.topic.noChapter');
  return (
    <Card>
      <Stack>
        <Subtitle>{t('plan.topics')}</Subtitle>
        {state.data.topics.map((topic) => (
          <Stack key={`${topic.chapterId}:${topic.topicId}`}>
            <p dir="auto">{nameOf(topic)}</p>
            <MutedText>
              {t('plan.topic.mastery')} {Math.round(topic.mastery * 100)}% · {topic.answered}/
              {topic.questions} {t('plan.topic.answered')} · {topic.weak} {t('plan.topic.weak')} ·{' '}
              {topic.due} {t('plan.topic.due')}
            </MutedText>
            {topic.smallSample && <MutedText>{t('plan.topic.small')}</MutedText>}
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}
