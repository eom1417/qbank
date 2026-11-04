import { useState } from 'react';
import type { DuplicatePair } from '../../../contracts/duplicates.js';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  MutedText,
  Row,
  Stack,
  Subtitle,
} from '../../design-system/index.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { QuestionTextDiff } from '../review/QuestionTextDiff.js';
import { decidePair } from './api.js';

type Side = DuplicatePair['a'];

/** One question of the pair: its book, page, number and approved answer (FR-10-003). */
function SideView({ side }: { side: Side }) {
  const { t } = useI18n();
  return (
    <Stack>
      <MutedText>
        {t('duplicates.from')} <bdi>{side.fileName}</bdi> · {t('review.page')} {side.page} ·{' '}
        {t('review.number')} {side.number}
      </MutedText>
      <MutedText>
        {t('duplicates.answer')} {side.answers.join(', ') || '—'} ·{' '}
        {t(`editor.status.${side.status as 'eligible'}`)}
      </MutedText>
    </Stack>
  );
}

/** A pair to compare and decide (UI-12, FR-10-004): never merged without the owner. */
export function PairCard({ pair, onDecided }: { pair: DuplicatePair; onDecided(): void }) {
  const { t } = useI18n();
  const [acknowledged, setAcknowledged] = useState(false);
  const decide = useAction(async (body: Parameters<typeof decidePair>[1]) => {
    await decidePair(pair.id, body);
    onDecided();
  });
  const sides = [pair.a, pair.b];
  return (
    <Card>
      <Stack>
        <Row>
          <Badge>{t(pair.kind === 'exact' ? 'duplicates.exact' : 'duplicates.similar')}</Badge>
          <MutedText>
            {t('duplicates.likeness')} {Math.round(pair.similarity * 100)}%
          </MutedText>
          {pair.decision && <Badge>{t(`duplicates.decided.${pair.decision}`)}</Badge>}
        </Row>
        {pair.differences.length > 0 && (
          <Alert tone="info">
            {t('duplicates.differences')} {pair.differences.join('، ')}
          </Alert>
        )}
        <QuestionTextDiff before={pair.a} after={pair.b} />
        {sides.map((side) => (
          <SideView key={side.id} side={side} />
        ))}
        {pair.answersDiffer && <Alert tone="error">{t('duplicates.answersDiffer')}</Alert>}
        {!pair.decision && (
          <Decisions
            pair={pair}
            acknowledged={acknowledged}
            onAcknowledge={setAcknowledged}
            decide={decide}
          />
        )}
      </Stack>
    </Card>
  );
}

interface DecisionsProps {
  pair: DuplicatePair;
  acknowledged: boolean;
  onAcknowledge(value: boolean): void;
  decide: {
    busy: boolean;
    error: string | null;
    run(body: Parameters<typeof decidePair>[1]): Promise<void>;
  };
}

function Decisions({ pair, acknowledged, onAcknowledge, decide }: DecisionsProps) {
  const { t } = useI18n();
  const reference = (questionId: string) =>
    void decide.run({
      decision: 'reference',
      questionId,
      acknowledgeDifferentAnswers: acknowledged,
    });
  return (
    <Stack>
      {pair.answersDiffer && (
        <Checkbox
          label={t('duplicates.acknowledge')}
          checked={acknowledged}
          onChange={(e) => onAcknowledge(e.target.checked)}
        />
      )}
      {decide.error && <Alert tone="error">{t(decide.error as 'error.internal')}</Alert>}
      <Button busy={decide.busy} onClick={() => void decide.run({ decision: 'kept_both' })}>
        {t('duplicates.keepBoth')}
      </Button>
      {[pair.a, pair.b].map((side) => (
        <Row key={side.id}>
          <Subtitle>
            <bdi>{side.fileName}</bdi> · {side.page}
          </Subtitle>
          <Button variant="secondary" busy={decide.busy} onClick={() => reference(side.id)}>
            {t('duplicates.reference')}
          </Button>
          <Button
            variant="ghost"
            busy={decide.busy}
            onClick={() => void decide.run({ decision: 'excluded', questionId: side.id })}
          >
            {t('duplicates.hide')}
          </Button>
        </Row>
      ))}
    </Stack>
  );
}
