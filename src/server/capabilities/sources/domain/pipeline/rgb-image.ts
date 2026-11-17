// M34 pipeline: a region of a page as raw RGB pixels, shared by the unit builder (P2) and the
// contact sheet (P3). Rendered by poppler as PPM (`pdftoppm -ppm`), never through a new library.

export interface RgbImage {
  width: number;
  height: number;
  /** Row-major RGB, 3 bytes per pixel. */
  data: Buffer;
}

function header(bytes: Buffer): { fields: number[]; end: number } {
  const fields: number[] = [];
  let at = 2;
  while (fields.length < 3) {
    while (/\s/.test(String.fromCharCode(bytes[at] ?? 32))) at++;
    if (bytes[at] === 0x23) {
      while (bytes[at] !== 0x0a && at < bytes.length) at++;
      continue;
    }
    const start = at;
    while (at < bytes.length && !/\s/.test(String.fromCharCode(bytes[at] ?? 32))) at++;
    fields.push(Number(bytes.subarray(start, at).toString('ascii')));
  }
  return { fields, end: at + 1 };
}

/** Parses a binary PPM (P6, 8 bits per channel); throws on anything else. */
export function parsePpm(bytes: Buffer): RgbImage {
  if (bytes.subarray(0, 2).toString('ascii') !== 'P6') throw new Error('not a binary PPM');
  const { fields, end } = header(bytes);
  const [width = 0, height = 0, max = 0] = fields;
  if (max !== 255) throw new Error('PPM must use 8 bits per channel');
  const data = bytes.subarray(end, end + width * height * 3);
  if (data.length !== width * height * 3) throw new Error('PPM is truncated');
  return { width, height, data };
}
