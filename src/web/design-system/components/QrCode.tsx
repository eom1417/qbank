import { encode } from 'uqr';

/** Light modules around the code, so a camera finds its edges on any background. */
const QUIET_ZONE = 4;

/**
 * A QR code for `value`, drawn as one SVG path in the theme's text colour on the surface colour.
 * `label` names it for screen readers; the same text is always shown beside it as well.
 */
export function QrCode({ value, label }: { value: string; label: string }) {
  const { data, size } = encode(value, { ecc: 'M', border: 0 });
  const total = size + QUIET_ZONE * 2;
  const path = data
    .flatMap((row, y) =>
      row.flatMap((dark, x) => (dark ? [`M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`] : [])),
    )
    .join('');
  return (
    <svg className="qb-qr" viewBox={`0 0 ${total} ${total}`} role="img" aria-label={label}>
      <rect className="qb-qr__light" width={total} height={total} />
      <path className="qb-qr__dark" d={path} />
    </svg>
  );
}
