import { useId } from 'react';
import { SelectField } from '../../design-system/index.js';
import { NONE, numberOrNull, withCurrent } from './policy-form.js';

/** A rule's error under its control, announced and linked to it. */
function RuleError({ id, error }: { id: string; error: string | undefined }) {
  if (!error) return null;
  return (
    <span className="qb-field__error" id={id} role="alert">
      {error}
    </span>
  );
}

interface ChoiceProps<V extends string> {
  label: string;
  value: V;
  options: readonly { value: V; label: string }[];
  onChange(value: V): void;
  error?: string | undefined;
}

/** One rule picked from named choices, with its error tied to the control. */
export function RuleChoice<V extends string>(props: ChoiceProps<V>) {
  const errorId = `${useId()}-error`;
  const byValue = new Map(props.options.map((o) => [String(o.value), o.value]));
  return (
    <div>
      <SelectField
        label={props.label}
        value={props.value}
        options={props.options}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={props.error ? errorId : undefined}
        onChange={(e) => props.onChange(byValue.get(e.target.value) ?? props.value)}
      />
      <RuleError id={errorId} error={props.error} />
    </div>
  );
}

interface NumberProps {
  label: string;
  value: number | null;
  options: readonly (number | null)[];
  format(n: number): string;
  noneLabel: string;
  onChange(value: number | null): void;
  error?: string | undefined;
}

/** One numeric rule picked from a short list; "none" stands for null. */
export function RuleNumber({ value, options, format, noneLabel, onChange, ...rest }: NumberProps) {
  const choices = withCurrent(options, value).map((n) => ({
    value: n === null ? NONE : String(n),
    label: n === null ? noneLabel : format(n),
  }));
  return (
    <RuleChoice
      {...rest}
      value={value === null ? NONE : String(value)}
      options={choices}
      onChange={(v) => onChange(numberOrNull(v))}
    />
  );
}
