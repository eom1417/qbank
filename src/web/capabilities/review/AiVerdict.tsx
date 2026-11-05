import type { QuestionResponse } from '../../../contracts/questions.js';
import { MutedText } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';

/** What the AI triage decided and why, with the file's own answer when it overturned it. */
export function AiVerdict({ question }: { question: QuestionResponse }) {
  const { t } = useI18n();
  return (
    <>
      {question.fileAnswer && (
        <MutedText>
          {t('triage.fileSaid')} <bdi>{question.fileAnswer}</bdi>
        </MutedText>
      )}
      {question.aiNote && (
        <MutedText>
          {t('triage.why')} <bdi>{question.aiNote}</bdi>
        </MutedText>
      )}
    </>
  );
}
