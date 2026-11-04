import type { ReactNode } from 'react';

/** The label every field shows above its control. */
export function FieldLabel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <label className="qb-field__label" htmlFor={id}>
      {children}
    </label>
  );
}

/** A field's error, announced and linked from its control by `${id}-error`. */
export function FieldError({ id, error }: { id: string; error: string | undefined }) {
  if (!error) return null;
  return (
    <span className="qb-field__error" id={`${id}-error`} role="alert">
      {error}
    </span>
  );
}
