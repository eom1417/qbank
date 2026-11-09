import type { ShareKind } from '../../../contracts/sharing.js';
import { Badge, Card, MutedText, Row, Stack, Title } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fill, policySentences, type AnyPolicy, type PolicyLineId } from './policy-sentences.js';
import { KIND_ICON } from './share-labels.js';

const LINE_ICON: Record<PolicyLineId, string> = {
  what: '📚',
  who: '👥',
  when: '⏱️',
  reveal: '👁️',
  records: '🗂️',
};

interface PolicyCardProps {
  kind: ShareKind;
  name: string;
  policy: AnyPolicy;
  /** The owner's preview names the chosen chapters; receivers see only how many. */
  chapterNames?: readonly string[];
}

/**
 * A share's whole policy as one plain-language card (DEC-39). The owner sees it before
 * publishing, and the people who receive the questions see the very same card.
 */
export function PolicyCard({ kind, name, policy, chapterNames }: PolicyCardProps) {
  const { t, locale } = useI18n();
  const speaker = {
    t,
    date: (iso: string) =>
      new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }),
  };
  const lines = policySentences(kind, policy, speaker, chapterNames);
  return (
    <Card>
      <Stack>
        <Row>
          <Title>
            <span aria-hidden="true">{KIND_ICON[kind]}</span> <bdi>{name}</bdi>
          </Title>
          <Badge>{t(`sharing.kind.${kind}`)}</Badge>
        </Row>
        {policy.presenter && (
          <MutedText>
            <bdi>{fill(t('sharing.card.presenter'), { name: policy.presenter })}</bdi>
          </MutedText>
        )}
        <ul className="qb-list" aria-label={t('sharing.card.label')}>
          {lines.map((line) => (
            <li key={line.id} className="qb-list__item">
              <span>
                <span aria-hidden="true">{LINE_ICON[line.id]}</span> {line.text}
              </span>
            </li>
          ))}
        </ul>
      </Stack>
    </Card>
  );
}
