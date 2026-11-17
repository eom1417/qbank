import { useCallback, useState } from 'react';
import type { QuestionResponse } from '../../../contracts/questions.js';
import type { PageReadingResponse } from '../../../contracts/review.js';
import {
  Alert,
  Button,
  Card,
  MutedText,
  SelectField,
  Stack,
  Subtitle,
} from '../../design-system/index.js';
import { useQuery } from '../../platform/api/use-query.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { PageCanvas } from './PageCanvas.js';
import { fetchPageReading, reassembleQuestion } from './page-reading-api.js';
import { RoleLegend } from './RoleLegend.js';
import { roleLabel } from './unit-roles.js';

type Unit = PageReadingResponse['pages'][number]['units'][number];

interface EditorProps {
  question: QuestionResponse;
  reading: PageReadingResponse;
  onChange(q: QuestionResponse): void;
}

/** The selected unit's words and its role picker. */
function UnitPicker(props: {
  unit: Unit;
  role: string;
  choices: string[];
  onRole(r: string): void;
}) {
  const { t } = useI18n();
  return (
    <Stack>
      <MutedText>
        {t('editor.pageReading.unit')}:{' '}
        <bdi>{props.unit.text ?? t('editor.pageReading.picture')}</bdi>
      </MutedText>
      <SelectField
        label={t('editor.pageReading.role')}
        value={props.role}
        options={props.choices.map((value) => ({ value, label: roleLabel(t, value) }))}
        onChange={(event) => props.onRole(event.target.value)}
      />
    </Stack>
  );
}

/** How many units changed, any refusal, and the re-assemble button. */
function SaveBar({ count, save }: { count: number; save: ReturnType<typeof useAction> }) {
  const { t } = useI18n();
  return (
    <>
      <MutedText>
        {t('editor.pageReading.changes')}: {count}
      </MutedText>
      {save.error && <Alert tone="error">{t(save.error)}</Alert>}
      <Button disabled={count === 0} busy={save.busy} onClick={() => void save.run()}>
        {t('editor.pageReading.reassemble')}
      </Button>
    </>
  );
}

/** The pages with their units, the owner's role changes, and re-assembly (Q26). */
function ReadingEditor({ question, reading, onChange }: EditorProps) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const [changes, setChanges] = useState<Record<string, string>>({});
  const units = reading.pages.flatMap((page) => page.units);
  const unit = units.find((u) => u.unitId === selected) ?? null;
  const roleOf = (u: Unit) => changes[u.unitId] ?? u.role;
  const save = useAction(async () => {
    const roles = Object.entries(changes).map(([unitId, role]) => ({ unitId, role }));
    onChange(await reassembleQuestion(question.id, { expectedVersion: question.version, roles }));
  });
  const choices = unit?.kind === 'text_line' ? reading.choices.text : reading.choices.picture;
  return (
    <Stack>
      <RoleLegend />
      {reading.pages.some((page) => !page.imageUrl) && (
        <MutedText>{t('editor.pageReading.noImage')}</MutedText>
      )}
      {reading.pages.map((page) => (
        <PageCanvas
          key={page.page}
          page={page}
          roleOf={roleOf}
          selected={selected}
          onSelect={setSelected}
        />
      ))}
      {unit ? (
        <UnitPicker
          unit={unit}
          role={roleOf(unit)}
          choices={choices}
          onRole={(role) => setChanges((previous) => ({ ...previous, [unit.unitId]: role }))}
        />
      ) : (
        <MutedText>{t('editor.pageReading.pick')}</MutedText>
      )}
      <SaveBar count={Object.keys(changes).length} save={save} />
    </Stack>
  );
}

/** Loads the page as read for this question version. */
function LoadedReading({ question, onChange }: Omit<EditorProps, 'reading'>) {
  const { t } = useI18n();
  const load = useCallback(() => fetchPageReading(question.id), [question.id]);
  const { state } = useQuery(load);
  if (state.status === 'loading') return <MutedText>{t('common.loading')}</MutedText>;
  if (state.status === 'error') return <Alert tone="error">{t(state.error)}</Alert>;
  if (!state.data.available) return <MutedText>{t('editor.pageReading.unavailable')}</MutedText>;
  return <ReadingEditor question={question} reading={state.data} onChange={onChange} />;
}

/**
 * "The page as read" (M34 P6, Q26): the original page with each unit outlined by its role; the
 * owner changes roles and re-assembles the question from its units, saved as a new version.
 */
export function PageReadingCard({ question, onChange }: Omit<EditorProps, 'reading'>) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const rebuilt = (changed: QuestionResponse) => {
    setSaved(true);
    onChange(changed);
  };
  return (
    <Card>
      <Subtitle>{t('editor.pageReading.title')}</Subtitle>
      {saved && <Alert tone="success">{t('editor.pageReading.saved')}</Alert>}
      {open ? (
        // A new version reloads the page as read, its roles as saved.
        <LoadedReading key={question.version} question={question} onChange={rebuilt} />
      ) : (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          {t('editor.pageReading.open')}
        </Button>
      )}
    </Card>
  );
}
