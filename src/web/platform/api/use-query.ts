import { useCallback, useEffect, useState } from 'react';
import type { MessageKey } from '../i18n/i18n.js';
import { errorMessageKey } from './messages.js';

export type QueryState<T> =
  { status: 'loading' } | { status: 'error'; error: MessageKey } | { status: 'ready'; data: T };

/**
 * Loads data for a screen. `load` must be stable (wrap it in useCallback with its inputs);
 * `reload` re-runs it after a change.
 */
export function useQuery<T>(load: () => Promise<T>) {
  const [state, setState] = useState<QueryState<T>>({ status: 'loading' });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    load().then(
      (data) => active && setState({ status: 'ready', data }),
      (error: unknown) => active && setState({ status: 'error', error: errorMessageKey(error) }),
    );
    return () => {
      active = false;
    };
  }, [load, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { state, reload };
}
