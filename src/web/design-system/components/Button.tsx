import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

/** Button look for a router link that acts as a call to action. */
export const buttonClass = (variant: Variant = 'primary') => `qb-button qb-button--${variant}`;

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
      className={buttonClass(variant)}
      disabled={busy || rest.disabled}
      aria-busy={busy || undefined}
    />
  );
}
