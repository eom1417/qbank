import { useState, type FormEvent } from 'react';
import { errorMessageKey, fieldMessageKeys } from '../api/messages.js';
import type { MessageKey } from '../i18n/i18n.js';

interface SubmitState {
  busy: boolean;
  error: MessageKey | null;
  fieldErrors: Record<string, MessageKey>;
}

const IDLE: SubmitState = { busy: false, error: null, fieldErrors: {} };

/** Shared form submission: one request at a time, honest error and field messages. */
export function useSubmit(action: (form: FormData) => Promise<void>) {
  const [state, setState] = useState<SubmitState>(IDLE);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.busy) return;
    const form = new FormData(event.currentTarget);
    setState({ ...IDLE, busy: true });
    try {
      await action(form);
      setState(IDLE);
    } catch (error) {
      setState({
        busy: false,
        error: errorMessageKey(error),
        fieldErrors: fieldMessageKeys(error),
      });
    }
  }
  return { ...state, onSubmit };
}

export const text = (form: FormData, name: string): string => String(form.get(name) ?? '');
