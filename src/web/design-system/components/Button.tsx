import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  busy?: boolean;
}

/** The only button in the app. `busy` disables it and announces progress. */
export function Button({ variant = 'primary', busy = false, type, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      type={type ?? 'button'}
      className={`qb-button qb-button--${variant}`}
      disabled={busy || rest.disabled}
      aria-busy={busy || undefined}
    />
  );
}
