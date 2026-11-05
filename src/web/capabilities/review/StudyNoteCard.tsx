import { useState } from 'react';
import type { SavedStudyNote } from '../../../contracts/questions.js';
import { Badge, Button, Card, MutedText, Row, Stack, Subtitle } from '../../design-system/index.js';
import { useI18n, type MessageKey } from '../../platform/i18n/i18n.js';

/** A list section of the note, left out when empty. */
function Points({ title, points }: { title: MessageKey; points: readonly string[] }) {
  const { t } = useI18n();
  if (points.length === 0) return null;
  return (
    <>
      <Subtitle>{t(title)}</Subtitle>
      <ul className="qb-list">
        {points.map((point, index) => (
          <li key={index} className="qb-list__item" dir="auto">
            {point}
          </li>
        ))}
      </ul>
    </>
  );
}

/** The sources: a link only where the page was opened and answered (DEC-34). */
function Sources({ sources }: { sources: SavedStudyNote['sources'] }) {
  const { t } = useI18n();
  if (sources.length === 0) return null;
  return (
    <>
      <Subtitle>{t('note.sources')}</Subtitle>
      <ul className="qb-list">
        {sources.map((source, index) => (
          <li key={index} className="qb-list__item">
            {source.url ? (
              <a href={source.url} target="_blank" rel="noreferrer noopener">
                <bdi>{source.title}</bdi>
              </a>
            ) : (
              <MutedText>
                <bdi>{source.title}</bdi> {t('note.unverifiedSource')}
              </MutedText>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/** The note's body: the idea, the answer, each option, variations and points to remember. */
export function StudyNoteBody({ note }: { note: SavedStudyNote }) {
  const { t } = useI18n();
  const options = note.options.map((option) => `${option.letter}: ${option.why}`);
  return (
    <Stack>
      <Row>
        <Badge>
          <bdi>{note.topic}</bdi>
        </Badge>
        {note.domain && <MutedText>{note.domain}</MutedText>}
      </Row>
      {note.questionIssue && <MutedText>{`${t('note.issue')}: ${note.questionIssue}`}</MutedText>}
      <Subtitle>{t('note.keyIdea')}</Subtitle>
      <p dir="auto">{note.keyIdea}</p>
      <Subtitle>{t('note.whyAnswer')}</Subtitle>
      <p dir="auto">{note.whyAnswer}</p>
      <Points title="note.options" points={options} />
      <Points title="note.ifThen" points={note.ifThen} />
      <Points title="note.pearls" points={note.pearls} />
      <Sources sources={note.sources} />
    </Stack>
  );
}

/**
 * The AI's study note on a question (DEC-34), kept apart from the book's explanation and opened
 * on demand.
 */
export function StudyNoteCard({ note }: { note: SavedStudyNote | null }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!note) return null;
  const title = note.kind === 'topic_review' ? 'note.topicReview' : 'note.title';
  return (
    <Card>
      <Stack>
        <Button variant="secondary" onClick={() => setOpen(!open)}>
          {t(title)}
        </Button>
        {open && <StudyNoteBody note={note} />}
      </Stack>
    </Card>
  );
}

/** What the AI changed on a question, as badges (DEC-34). */
export function AiChangeBadges({ changes }: { changes: readonly string[] }) {
  const { t } = useI18n();
  if (changes.length === 0) return null;
  return (
    <Row>
      {changes.map((change) => (
        <Badge key={change}>{t(`change.${change}` as MessageKey)}</Badge>
      ))}
    </Row>
  );
}
