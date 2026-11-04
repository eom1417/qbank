import { useCallback } from 'react';
import type { QuestionResponse } from '../../../contracts/questions.js';
import type { QuestionVersion } from '../../../contracts/review.js';
import { Button, Card, DiffText, MutedText, Stack, Subtitle } from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchHistory, restoreVersion } from './api.js';
import { wordDiff } from '../../platform/text/word-diff.js';
import { originLabel } from './labels.js';

/** A version's words as one text: the stem, then each option, then the answer. */
const textOf = (v: QuestionVersion) =>
  [v.stem, ...v.options.map((o) => `${o.letter}. ${o.text}`), `→ ${v.answers.join(', ')}`].join(
    '\n',
  );

interface Props {
  question: QuestionResponse;
  onRestored(question: QuestionResponse): void;
}

/**
 * Every saved version, newest first, each with what made it and what it changed from the one
 * before (FR-09-008, UAT-033); any earlier one can be brought back.
 */
export function HistoryCard({ question, onRestored }: Props) {
  const { t, locale } = useI18n();
  const load = useCallback(() => fetchHistory(question.id), [question.id]);
  const { state } = useQuery(load);
  const restore = useAction(async (version: number) =>
    onRestored(await restoreVersion(question.id, version)),
  );
  if (state.status !== 'ready') return null;
  const { versions } = state.data;
  return (
    <Card>
      <Stack>
        <Subtitle>{t('editor.history')}</Subtitle>
        {versions.map((version, index) => {
          const previous = versions[index + 1];
          return (
            <Stack key={version.version}>
              <MutedText>
                {originLabel(t, version.origin)} ·{' '}
                {new Date(version.createdAt).toLocaleString(locale)}
              </MutedText>
              <DiffText segments={wordDiff(previous ? textOf(previous) : '', textOf(version))} />
              {index > 0 && (
                <Button
                  variant="ghost"
                  busy={restore.busy}
                  onClick={() => void restore.run(version.version)}
                >
                  {t('editor.history.restore')}
                </Button>
              )}
            </Stack>
          );
        })}
      </Stack>
    </Card>
  );
}
