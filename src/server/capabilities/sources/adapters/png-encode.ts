// M34 P3: an RGB image as a PNG with Node's own zlib (no image library): 8-bit truecolor, no
// interlace, filter 0 on every row.
import { crc32, deflateSync } from 'node:zlib';
import type { RgbImage } from '../domain/pipeline/rgb-image.js';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const BIT_DEPTH = 8;
const COLOR_TRUECOLOR = 2;

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

function header(image: RgbImage): Buffer {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(image.width, 0);
  data.writeUInt32BE(image.height, 4);
  data.writeUInt8(BIT_DEPTH, 8);
  data.writeUInt8(COLOR_TRUECOLOR, 9);
  // compression 0, filter method 0, no interlace: the three bytes stay 0.
  return data;
}

/** Each row prefixed with filter type 0 (none). */
function scanlines(image: RgbImage): Buffer {
  const stride = image.width * 3;
  const out = Buffer.alloc((stride + 1) * image.height);
  for (let row = 0; row < image.height; row++) {
    image.data.copy(out, row * (stride + 1) + 1, row * stride, (row + 1) * stride);
  }
  return out;
}

/** Encodes a row-major RGB image as PNG bytes; throws when the pixel buffer is the wrong size. */
export function encodePng(image: RgbImage): Buffer {
  if (image.width < 1 || image.height < 1 || image.data.length !== image.width * image.height * 3) {
    throw new Error('the image size does not match its pixels');
  }
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header(image)),
    chunk('IDAT', deflateSync(scanlines(image))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
