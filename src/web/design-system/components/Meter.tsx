import type { CSSProperties } from 'react';

interface MeterProps {
  /** 0 to 100. */
  percent: number;
  label: string;
}

/** A bar for a used share (a usage limit); never the only carrier of the number. */
export function Meter({ percent, label }: MeterProps) {
  const value = Math.max(0, Math.min(100, percent));
  const style = { '--qb-meter': value } as CSSProperties;
  return (
    <div
      className="qb-meter"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <div className="qb-meter__bar" style={style} />
    </div>
  );
}
