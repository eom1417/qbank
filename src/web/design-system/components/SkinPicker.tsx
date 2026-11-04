import { useId } from 'react';

interface SkinOption {
  value: string;
  label: string;
  description: string;
  badge?: string | undefined;
}

interface SkinPickerProps {
  legend: string;
  options: readonly SkinOption[];
  value: string;
  onChange(value: string): void;
}

/** A miniature of the app drawn with the skin's own tokens (`data-skin` scopes them). */
function Preview({ skin }: { skin: string }) {
  return (
    <span className="qb-skin__preview" data-skin={skin} aria-hidden="true">
      <span className="qb-skin__bar" />
      <span className="qb-skin__page">
        <span className="qb-skin__line" />
        <span className="qb-skin__card">
          <span className="qb-skin__option qb-skin__option--chosen" />
          <span className="qb-skin__option" />
          <span className="qb-skin__button" />
        </span>
      </span>
    </span>
  );
}

/** The skins as native radio buttons in cards, each showing what it looks like. */
export function SkinPicker({ legend, options, value, onChange }: SkinPickerProps) {
  const name = useId();
  return (
    <fieldset className="qb-skins">
      <legend className="qb-field__label">{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className="qb-skin">
          <Preview skin={option.value} />
          <span className="qb-skin__text">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <span className="qb-skin__name">{option.label}</span>
            {option.badge && <span className="qb-badge">{option.badge}</span>}
          </span>
          <span className="qb-muted">{option.description}</span>
        </label>
      ))}
    </fieldset>
  );
}
