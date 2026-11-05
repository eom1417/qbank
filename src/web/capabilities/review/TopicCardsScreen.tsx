import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { TopicCardsResponse } from '../../../contracts/questions.js';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Heading,
  MutedText,
  Stack,
} from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { fetchTopicCards } from './api.js';
import { StudyNoteBody } from './StudyNoteCard.js';

type TopicCard = TopicCardsResponse['cards'][number];

/** One card: the question as printed, then its topic review when the owner asks for it. */
function TopicCardView({ card }: { card: TopicCard }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <Stack>
        <p dir="auto">{card.stem}</p>
        {card.options.map((option) => (
          <p key={option.letter} dir="auto">
            {option.label} {option.text}
          </p>
        ))}
        <Button variant={open ? 'ghost' : 'primary'} onClick={() => setOpen(!open)}>
          {t(open ? 'topics.hide' : 'topics.show')}
        </Button>
        {open && <StudyNoteBody note={card.note} />}
      </Stack>
    </Card>
  );
}

/**
 * Topic cards (DEC-34): the questions that cannot be answered as printed (notes only, missing
 * data, unclear), studied as a question first, then its topic review.
 */
export function TopicCardsScreen() {
  const { t } = useI18n();
  const bankId = useParams()['bankId'] ?? '';
  const { state } = useQuery(useCallback(() => fetchTopicCards(bankId), [bankId]));
  if (state.status === 'loading') return <MutedText>{t('common.loading')}</MutedText>;
  if (state.status === 'error') return <Alert tone="error">{t(state.error)}</Alert>;
  const { cards } = state.data;
  return (
    <Stack>
      <Link to={`/banks/${bankId}`}>{t('review.back')}</Link>
      <Heading>{t('topics.title')}</Heading>
      <MutedText>{t('topics.lead')}</MutedText>
      {cards.length === 0 && (
        <EmptyState title={t('topics.title')} description={t('topics.empty')} />
      )}
      {cards.map((card) => (
        <TopicCardView key={card.id} card={card} />
      ))}
    </Stack>
  );
}
