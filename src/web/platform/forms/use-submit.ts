import { useState, type FormEvent } from 'react';
import { errorMessageKey, fieldMessageKeys } from '../api/messages.js';
import type { MessageKey } from '../i18n/i18n.js';

interface SubmitState {
  busy: boolean;
  error: MessageKey | null;
  fieldErrors: Record<string, MessageKey>;
}

const IDLE: SubmitState = { busy: false, error: null, fieldErrors: {} };

/** Shared async action (a button or a form): one run at a time, honest error and field messages. */
export function useAction<A extends unknown[]>(action: (...args: A) => Promise<void>) {
  const [state, setState] = useState<SubmitState>(IDLE);
  async function run(...args: A) {
    if (state.busy) return;
    setState({ ...IDLE, busy: true });
    try {
      await action(...args);
      setState(IDLE);
    } catch (error) {
      setState({
        busy: false,
        error: errorMessageKey(error),
        fieldErrors: fieldMessageKeys(error),
      });
    }
  }
  return { ...state, run };
}

/** Shared form submission, built on useAction. */
export function useSubmit(action: (form: FormData) => Promise<void>) {
  const { run, ...state } = useAction(action);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(new FormData(event.currentTarget));
  }
  return { ...state, onSubmit };
}

export const text = (form: FormData, name: string): string => String(form.get(name) ?? '');

/** An optional number field: empty means "not set". */
export const numberOrNull = (form: FormData, name: string): number | null => {
  const value = text(form, name).trim();
  return value === '' ? null : Number(value);
};
