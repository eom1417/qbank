import { useState } from 'react';
import type { BankResponse } from '../../../contracts/library.js';
import {
  Alert,
  Badge,
  Button,
  Card,
  Heading,
  MutedText,
  Row,
  TextField,
} from '../../design-system/index.js';
import { text, useSubmit } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { setBankArchived, updateBank } from './api.js';

interface Props {
  bank: BankResponse;
  onChange(bank: BankResponse): void;
}

function EditBankForm({ bank, onDone }: { bank: BankResponse; onDone(bank?: BankResponse): void }) {
  const { t } = useI18n();
  const form = useSubmit(async (data) => {
    const changes = {
      name: text(data, 'name'),
      subject: text(data, 'subject'),
      description: text(data, 'description'),
    };
    onDone(await updateBank(bank.id, changes));
  });
  const nameError = form.fieldErrors['name'];
  return (
    <form className="qb-stack" onSubmit={form.onSubmit} noValidate>
      {form.error && <Alert tone="error">{t(form.error)}</Alert>}
      <TextField
        name="name"
        required
        maxLength={120}
        defaultValue={bank.name}
        label={t('library.field.name')}
        error={nameError && t(nameError)}
      />
      <TextField
        name="subject"
        maxLength={120}
        defaultValue={bank.subject ?? ''}
        label={t('library.field.subject')}
      />
      <TextField
        name="description"
        maxLength={2000}
        defaultValue={bank.description ?? ''}
        label={t('library.field.description')}
      />
      <Row>
        <Button type="submit" busy={form.busy}>
          {t('settings.save')}
        </Button>
        <Button variant="ghost" onClick={() => onDone()}>
          {t('bank.cancel')}
        </Button>
      </Row>
    </form>
  );
}

/** Bank header (UI-06): details, edit, archive and restore (FR-03-008, FR-19-008). */
export function BankDetailsCard({ bank, onChange }: Props) {
  const { t, locale } = useI18n();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const toggleArchive = async () => {
    setBusy(true);
    try {
      onChange(await setBankArchived(bank.id, !bank.archived));
    } finally {
      setBusy(false);
    }
  };
  const finishEditing = (updated?: BankResponse) => {
    setEditing(false);
    if (updated) onChange(updated);
  };
  if (editing) {
    return (
      <Card>
        <EditBankForm bank={bank} onDone={finishEditing} />
      </Card>
    );
  }
  return (
    <Card>
      <Heading>{bank.name}</Heading>
      {bank.archived && <Badge>{t('library.archived')}</Badge>}
      {bank.archived && <Alert tone="info">{t('bank.archivedNote')}</Alert>}
      {bank.subject && <MutedText>{bank.subject}</MutedText>}
      {bank.description && <p>{bank.description}</p>}
      <MutedText>
        {t('bank.created')}: {new Date(bank.createdAt).toLocaleDateString(locale)}
      </MutedText>
      <Row>
        <Button variant="secondary" onClick={() => setEditing(true)}>
          {t('bank.edit')}
        </Button>
        <Button variant="secondary" busy={busy} onClick={() => void toggleArchive()}>
          {t(bank.archived ? 'bank.restore' : 'bank.archive')}
        </Button>
      </Row>
    </Card>
  );
}
