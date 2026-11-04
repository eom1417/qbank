import { useId } from 'react';

export interface Choice {
  value: string;
  label: string;
  /** After the answer: right, the user's wrong pick, or nothing to say. */
  mark?: 'right' | 'wrong' | undefined;
  /** What the mark means, in words: never colour alone (UAT-083). */
  markLabel?: string | undefined;
}

const SYMBOL = { right: '✓', wrong: '✕' } as const;

interface ChoiceListProps {
  legend: string;
  choices: readonly Choice[];
  selected: readonly string[];
  /** Several right answers allowed (checkboxes) or one (radio buttons). */
  multiple: boolean;
  /** Locked once the answer is sent. */
  disabled?: boolean;
  onChange(selected: string[]): void;
}

/** The options of a question as native radio buttons or checkboxes, marked after the answer. */
export function ChoiceList({
  legend,
  choices,
  selected,
  multiple,
  disabled = false,
  onChange,
}: ChoiceListProps) {
  const name = useId();
  const toggle = (value: string) => {
    if (!multiple) return onChange([value]);
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };
  return (
    <fieldset className="qb-choices">
      <legend className="qb-field__label">{legend}</legend>
      {choices.map((choice) => (
        <label
          key={choice.value}
          className={`qb-choice${choice.mark ? ` qb-choice--${choice.mark}` : ''}`}
        >
          <input
            type={multiple ? 'checkbox' : 'radio'}
            name={name}
            value={choice.value}
            checked={selected.includes(choice.value)}
            disabled={disabled}
            onChange={() => toggle(choice.value)}
          />
          <span dir="auto">{choice.label}</span>
          {choice.mark && (
            <span className="qb-choice__mark">
              <span aria-hidden="true">{SYMBOL[choice.mark]}</span> {choice.markLabel}
            </span>
          )}
        </label>
      ))}
    </fieldset>
  );
}
