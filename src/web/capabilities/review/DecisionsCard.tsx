import type { QuestionResponse } from '../../../contracts/questions.js';
import { Alert, Badge, Button, Card, Row, Stack } from '../../design-system/index.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { AiVerdict } from './AiVerdict.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { decide, type Decision } from './api.js';
import { reasonLabel } from './labels.js';

interface Props {
  question: QuestionResponse;
  onChange(question: QuestionResponse): void;
}

/** The decisions that fit the question's state (FR-09-004): hide and bring back, never delete. */
function decisionsFor(question: QuestionResponse): Decision[] {
  if (question.status === 'excluded') return ['restore'];
  if (question.status === 'needs_review') return ['approve', 'defer', 'exclude'];
  return ['exclude'];
}

/** Where the question stands, why, and what the owner can decide now. */
export function DecisionsCard({ question, onChange }: Props) {
  const { t } = useI18n();
  const act = useAction(async (decision: Decision) =>
    onChange(await decide(question.id, decision)),
  );
  return (
    <Card>
      <Stack>
        <Row>
          <Badge>
            {t('editor.status')} {t(`editor.status.${question.status}`)}
          </Badge>
          <Badge>
            {t('editor.provenance')} {t(`editor.provenance.${question.provenance}`)}
          </Badge>
        </Row>
        <AiVerdict question={question} />
        <Row>
          {question.reviewReasons.map((reason) => (
            <Badge key={reason}>{reasonLabel(t, reason)}</Badge>
          ))}
        </Row>
        {act.error && <Alert tone="error">{t(act.error)}</Alert>}
        <Row>
          {decisionsFor(question).map((decision) => (
            <Button
              key={decision}
              variant={decision === 'approve' ? 'primary' : 'secondary'}
              busy={act.busy}
              onClick={() => void act.run(decision)}
            >
              {t(`review.decision.${decision}`)}
            </Button>
          ))}
        </Row>
      </Stack>
    </Card>
  );
}
