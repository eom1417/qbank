import { useState } from 'react';
import type { DriverView } from '../../../contracts/providers.js';
import { Button, Card, SelectField, Stack, TextField, Title } from '../../design-system/index.js';
import { useAction } from '../../platform/forms/use-submit.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { addInstance } from './instances.js';

interface AddProps {
  drivers: readonly DriverView[];
  onError(error: unknown): void;
}

interface FieldsProps {
  driver: DriverView;
  values: Record<string, string>;
  onChange(values: Record<string, string>): void;
}

/** The driver's API-key and similar fields (the kit's environmentFields). */
function EnvironmentFields({ driver, values, onChange }: FieldsProps) {
  return driver.environmentFields.map((field) => (
    <TextField
      key={field.name}
      label={field.label}
      {...(field.description ? { hint: field.description } : {})}
      type={field.sensitive ? 'password' : 'text'}
      autoComplete="off"
      value={values[field.name] ?? ''}
      onChange={(event) => onChange({ ...values, [field.name]: event.target.value })}
    />
  ));
}

/** Another account or tool: any driver the kit knows, with its API-key fields (sensitive). */
export function AddProviderCard({ drivers, onError }: AddProps) {
  const { t } = useI18n();
  const ordered = [...drivers].sort((a, b) => Number(b.featured) - Number(a.featured));
  const [driver, setDriver] = useState(ordered[0]?.driverKind ?? '');
  const [name, setName] = useState('');
  const [environment, setEnvironment] = useState<Record<string, string>>({});
  const chosen = ordered.find((candidate) => candidate.driverKind === driver);
  const add = useAction(async () => {
    await addInstance(driver, name, environment).then(() => {
      setName('');
      setEnvironment({});
    }, onError);
  });
  return (
    <Card>
      <Stack>
        <Title>{t('add.title')}</Title>
        <SelectField
          label={t('add.driver')}
          options={ordered.map((candidate) => ({
            value: candidate.driverKind,
            label: candidate.label,
          }))}
          value={driver}
          onChange={(event) => setDriver(event.target.value)}
        />
        <TextField
          label={t('add.name')}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        {chosen && (
          <EnvironmentFields driver={chosen} values={environment} onChange={setEnvironment} />
        )}
        <Button busy={add.busy} disabled={!driver} onClick={() => void add.run()}>
          {t('add.submit')}
        </Button>
      </Stack>
    </Card>
  );
}
