import type { QuestionResponse } from '../../../contracts/questions.js';
import { Alert, Button, Card, MutedText, Row, Stack, Subtitle } from '../../design-system/index.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { QuestionTextDiff } from '../review/QuestionTextDiff.js';
import { chooseReimport } from './api.js';

/** The owner's edited text against a re-import's new reading (FR-10-006); the owner chooses. */
export function ReimportCard({
  question,
  onChosen,
}: {
  question: QuestionResponse;
  onChosen(q: QuestionResponse): void;
}) {
  const { t } = useI18n();
  const choose = useAction(async (use: 'new' | 'mine') =>
    onChosen(await chooseReimport(question.id, use)),
  );
  const fresh = question.reimportText;
  if (!fresh) return null;
  return (
    <Card>
      <Stack>
        <Subtitle>{t('reimport.title')}</Subtitle>
        <MutedText>{t('reimport.lead')}</MutedText>
        <QuestionTextDiff before={question} after={fresh} />
        {choose.error && <Alert tone="error">{t(choose.error)}</Alert>}
        <Row>
          <Button busy={choose.busy} onClick={() => void choose.run('mine')}>
            {t('reimport.mine')}
          </Button>
          <Button variant="secondary" busy={choose.busy} onClick={() => void choose.run('new')}>
            {t('reimport.new')}
          </Button>
        </Row>
      </Stack>
    </Card>
  );
}
