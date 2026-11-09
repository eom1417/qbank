import { useCallback } from 'react';
import { fill } from '../../platform/i18n/fill.js';
import { useI18n, type MessageKey } from '../../platform/i18n/i18n.js';
import { modeKey } from '../../platform/i18n/mode-keys.js';
import { useSession } from './session.js';

/**
 * Fills `{operator}` with the server's declared operator (DEC-40), or with a plain "the server
 * operator" when no name is set.
 */
export function useOperatorFill(): (text: string) => string {
  const { t } = useI18n();
  const { operatorName } = useSession();
  const operator = operatorName ?? t('server.operator.fallback');
  return useCallback((text: string) => fill(text, { operator }), [operator]);
}

/**
 * Honest texts per mode (M31, B3): a text that differs on a server is read from its `.server`
 * variant there, with `{operator}` filled in.
 */
export function useModeCopy(): (key: MessageKey) => string {
  const { t } = useI18n();
  const { mode } = useSession();
  const withOperator = useOperatorFill();
  return useCallback(
    (key: MessageKey) => withOperator(t(modeKey(key, mode))),
    [t, mode, withOperator],
  );
}
