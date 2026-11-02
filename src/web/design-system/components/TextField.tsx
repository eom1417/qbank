import { useId, type InputHTMLAttributes } from 'react';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | undefined;
}

/** Labelled text input; the error is announced and linked via aria-describedby. */
export function TextField({ label, hint, error, ...input }: TextFieldProps) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ');
  return (
    <div className="qb-field">
      <label className="qb-field__label" htmlFor={id}>
        {label}
      </label>
      {hint && (
        <span className="qb-field__hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      <input
        {...input}
        id={id}
        className="qb-field__input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
      />
      {error && (
        <span className="qb-field__error" id={`${id}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
