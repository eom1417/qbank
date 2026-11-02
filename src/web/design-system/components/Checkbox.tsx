import type { InputHTMLAttributes, ReactNode } from 'react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  error?: string | undefined;
}

export function Checkbox({ label, error, ...input }: CheckboxProps) {
  return (
    <div className="qb-field">
      <label className="qb-check">
        <input {...input} type="checkbox" aria-invalid={error ? true : undefined} />
        <span>{label}</span>
      </label>
      {error && (
        <span className="qb-field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
