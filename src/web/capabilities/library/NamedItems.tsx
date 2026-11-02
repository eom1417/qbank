import { useRef, useState } from 'react';
import { Alert, Button, ConfirmButton, Row, TextField } from '../../design-system/index.js';
import { text, useSubmit } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';

interface AddNameFormProps {
  label: string;
  submitLabel: string;
  onAdd(name: string): Promise<unknown>;
}

/** One-field inline form for adding a chapter, topic or tag. */
export function AddNameForm({ label, submitLabel, onAdd }: AddNameFormProps) {
  const { t } = useI18n();
  const formRef = useRef<HTMLFormElement>(null);
  const form = useSubmit(async (data) => {
    await onAdd(text(data, 'name'));
    formRef.current?.reset(); // only after success: a failed add keeps what the user typed
  });
  const nameError = form.fieldErrors['name'];
  return (
    <form ref={formRef} className="qb-row" onSubmit={form.onSubmit} noValidate>
      <TextField
        name="name"
        required
        maxLength={120}
        label={label}
        error={nameError && t(nameError)}
      />
      <Button type="submit" variant="secondary" busy={form.busy}>
        {submitLabel}
      </Button>
      {form.error && !nameError && <Alert tone="error">{t(form.error)}</Alert>}
    </form>
  );
}

interface NamedItemRowProps {
  name: string;
  onRename(name: string): Promise<unknown>;
  onDelete(): Promise<unknown>;
}

/** A named item with rename (inline) and two-step delete. */
export function NamedItemRow({ name, onRename, onDelete }: NamedItemRowProps) {
  const { t } = useI18n();
  const [renaming, setRenaming] = useState(false);
  if (renaming) {
    return (
      <AddNameForm
        label={t('taxonomy.rename')}
        submitLabel={t('settings.save')}
        onAdd={async (newName) => {
          await onRename(newName);
          setRenaming(false);
        }}
      />
    );
  }
  return (
    <Row>
      <span className="qb-grow">{name}</span>
      <Button variant="ghost" onClick={() => setRenaming(true)}>
        {t('taxonomy.rename')}
      </Button>
      <ConfirmButton
        label={t('taxonomy.delete')}
        confirmLabel={t('taxonomy.confirmDelete')}
        onConfirm={() => void onDelete()}
      />
    </Row>
  );
}
