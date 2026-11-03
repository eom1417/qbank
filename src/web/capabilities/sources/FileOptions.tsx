import { SourceLanguage, SourceType } from '../../../contracts/sources.js';
import {
  Button,
  MutedText,
  Row,
  SelectField,
  Stack,
  Subtitle,
  TextField,
} from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';

/** One chosen file and its own settings (FR-04-004…006). */
export interface ChosenFile {
  key: string;
  file: File;
  pageFrom: string;
  pageTo: string;
  language: SourceLanguage;
  sourceType: SourceType;
  error: string | null;
}

interface Props {
  chosen: ChosenFile;
  onChange(chosen: ChosenFile): void;
  onRemove(): void;
}

interface PageRangeProps {
  chosen: ChosenFile;
  set(changes: Partial<ChosenFile>): void;
}

/** The pages to read (FR-04-004); empty means the whole file. */
function PageRange({ chosen, set }: PageRangeProps) {
  const { t } = useI18n();
  return (
    <Row>
      <TextField
        label={t('import.pageFrom')}
        type="number"
        min={1}
        value={chosen.pageFrom}
        onChange={(event) => set({ pageFrom: event.target.value })}
      />
      <TextField
        label={t('import.pageTo')}
        type="number"
        min={1}
        value={chosen.pageTo}
        onChange={(event) => set({ pageTo: event.target.value })}
      />
    </Row>
  );
}

const megabytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

/** A file waiting to be uploaded: page range, language and type, or removed (FR-04-008). */
export function FileOptions({ chosen, onChange, onRemove }: Props) {
  const { t } = useI18n();
  const set = (changes: Partial<ChosenFile>) => onChange({ ...chosen, ...changes });
  const languages = SourceLanguage.options.map((value) => ({
    value,
    label: t(`source.language.${value}`),
  }));
  const types = SourceType.options.map((value) => ({ value, label: t(`source.type.${value}`) }));
  return (
    <Stack>
      <Row>
        <Subtitle>
          <bdi>{chosen.file.name}</bdi>
        </Subtitle>
        <MutedText>{megabytes(chosen.file.size)} MB</MutedText>
      </Row>
      <PageRange chosen={chosen} set={set} />
      <Row>
        <SelectField
          label={t('import.language')}
          options={languages}
          value={chosen.language}
          onChange={(event) => set({ language: event.target.value as SourceLanguage })}
        />
        <SelectField
          label={t('import.sourceType')}
          options={types}
          value={chosen.sourceType}
          onChange={(event) => set({ sourceType: event.target.value as SourceType })}
        />
      </Row>
      {chosen.error && <MutedText>{chosen.error}</MutedText>}
      <Button variant="ghost" onClick={onRemove}>
        {t('import.remove')}
      </Button>
    </Stack>
  );
}
