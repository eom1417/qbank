import { Card, TextField } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { FileOptions, type ChosenFile } from './FileOptions.js';
import type { ImportForm } from './use-import-form.js';

let counter = 0;
const choose = (file: File): ChosenFile => ({
  key: `${(counter += 1)}-${file.name}`,
  file,
  pageFrom: '',
  pageTo: '',
  language: 'auto',
  sourceType: 'question_bank',
  error: null,
});

interface FilesCardProps {
  files: ImportForm['files'];
  setFiles: ImportForm['setFiles'];
}

/** The files to upload and each one's settings; files can be added or removed (FR-04-002). */
export /** The files to upload and each one's settings; files can be added or removed (FR-04-002). */
function FilesCard({ files, setFiles }: FilesCardProps) {
  const { t } = useI18n();
  const add = (list: FileList | null) =>
    setFiles((previous) => [...previous, ...[...(list ?? [])].map(choose)]);
  const update = (next: ChosenFile) =>
    setFiles((previous) => previous.map((other) => (other.key === next.key ? next : other)));
  const remove = (key: string) =>
    setFiles((previous) => previous.filter((other) => other.key !== key));
  return (
    <Card>
      <TextField
        type="file"
        label={t('import.files')}
        hint={t('import.filesHint')}
        accept="application/pdf"
        multiple
        onChange={(event) => add(event.target.files)}
      />
      {files.map((chosen) => (
        <FileOptions
          key={chosen.key}
          chosen={chosen}
          onChange={update}
          onRemove={() => remove(chosen.key)}
        />
      ))}
    </Card>
  );
}
