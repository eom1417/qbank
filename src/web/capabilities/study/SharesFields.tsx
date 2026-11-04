import type { MixShares } from '../../../contracts/study.js';
import { Alert, Button, MutedText, Row, Stack, TextField } from '../../design-system/index.js';
import { useI18n } from '../../platform/i18n/i18n.js';
import { DEFAULT_SHARES } from './use-study-setup.js';

interface Props {
  shares: MixShares;
  groups: { new: number; weak: number; due: number } | null | undefined;
  onChange(shares: MixShares): void;
}

const GROUPS = ['new', 'weak', 'due'] as const;

/** Smart Mix's shares, changeable and back to the default at once (FR-14-007), with what is ready. */
export function SharesFields({ shares, groups, onChange }: Props) {
  const { t } = useI18n();
  const total = shares.new + shares.weak + shares.due;
  return (
    <Stack>
      <MutedText>{t('plan.shares')}</MutedText>
      <Row>
        {GROUPS.map((g) => (
          <TextField
            key={g}
            label={t(`plan.shares.${g}`)}
            type="number"
            min={0}
            max={100}
            value={shares[g]}
            onChange={(e) => onChange({ ...shares, [g]: Number(e.target.value) })}
          />
        ))}
      </Row>
      {total !== 100 && <Alert tone="error">{t('plan.shares.total')}</Alert>}
      <Button variant="ghost" onClick={() => onChange(DEFAULT_SHARES)}>
        {t('plan.shares.reset')}
      </Button>
      {groups && (
        <MutedText>
          {t('plan.groups')} {t('plan.shares.new')} {groups.new} · {t('plan.shares.weak')}{' '}
          {groups.weak} · {t('plan.shares.due')} {groups.due}
        </MutedText>
      )}
    </Stack>
  );
}
