import { useId, type TextareaHTMLAttributes } from 'react';
import { FieldError, FieldLabel } from './FieldParts.js';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string | undefined;
}

/** Labelled multi-line text (a question stem, an explanation); its text keeps its direction. */
export function TextArea({ label, error, rows = 4, ...area }: TextAreaProps) {
  const id = useId();
  return (
    <div className="qb-field">
      <FieldLabel id={id}>{label}</FieldLabel>
      <textarea
        dir="auto"
        rows={rows}
        {...area}
        id={id}
        className="qb-field__input qb-field__input--area"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <FieldError id={id} error={error} />
    </div>
  );
}
