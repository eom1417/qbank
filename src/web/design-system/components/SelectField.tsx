import { useId, type SelectHTMLAttributes } from 'react';
import { FieldLabel } from './FieldParts.js';

interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: readonly SelectOption[];
}

/** The only select in the app: a native control (keyboard and screen-reader friendly) with a label. */
export function SelectField({ label, options, ...select }: SelectFieldProps) {
  const id = useId();
  return (
    <div className="qb-field">
      <FieldLabel id={id}>{label}</FieldLabel>
      <select {...select} id={id} className="qb-field__input">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
