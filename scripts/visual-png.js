/** Dependency-free PNG comparator for Chromium RGB/RGBA (8 bit) screenshots. */
import {inflateSync, deflateSync} from 'node:zlib';
const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let n = i; for (let j = 0; j < 8; j++) n =
    n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; crcTable[i] = n >>> 0;
}
function crc32(data) {
  let crc = 0xffffffff; for (const byte of data) crc =
    crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const header = Buffer.from(type, 'ascii'); const length =
    Buffer.alloc(4); length.writeUInt32BE(data.length);
  const check = Buffer.alloc(4); check.writeUInt32BE(crc32(Buffer.concat([header, data])));
  return Buffer.concat([length, header, data, check]);
}

export function decodePNG(bytes) {
  if (!bytes.subarray(0, 8)
    .equals(sig)) throw new Error('Not a PNG screenshot');
  let offset = 8, width = 0, height = 0, channels = 0, bitDepth =
    0, interlace = 0;
  const idat = [];
  while (offset < bytes.length) {
    const size = bytes.readUInt32BE(offset); const type =
      bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + size); offset +=
      size + 12;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height =
        data.readUInt32BE(4); bitDepth = data[8]; channels = data[9] === 2 ?
          3 : data[9] === 6 ? 4 : 0; interlace = data[12];
    }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }
  if (!channels || bitDepth !== 8 || interlace !== 0 || !width ||
    !height) throw new Error('Unsupported PNG format (expected 8-bit noninterlaced RGB/RGBA)');
  const input = inflateSync(Buffer.concat(idat)); const stride = width *
    channels;
  const output = Buffer.allocUnsafe(stride * height); let pos = 0;
  for (let row = 0; row < height; row++) {
    const filter = input[pos++]; const at = row * stride;
    for (let x = 0; x < stride; x++) {
      const val = input[pos++]; const left = x >= channels ? output[at + x -
        channels] : 0;
      const top = row ? output[at - stride + x] : 0;
      const topLeft = row && x >= channels ? output[at - stride + x -
        channels] : 0;
      let pred = 0;
      if (filter === 1) pred = left;
      else if (filter === 2) pred = top;
      else if (filter === 3) pred = Math.floor((left + top) / 2);
      else if (filter === 4) {
        const p = left + top - topLeft;
        const a = Math.abs(p - left), b = Math.abs(p - top), c =
          Math.abs(p - topLeft);
        pred = a <= b && a <= c ? left : b <= c ? top : topLeft;
      } else if (filter !==
        0) throw new Error(`Unsupported PNG filter ${filter}`);
      output[at + x] = (val + pred) & 255;
    }
  }
  return {width, height, channels, pixels: output};
}

export function encodeRGB(width, height, rgb) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const rows = Buffer.allocUnsafe((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const start = y * (width * 3 +
      1); rows[start] = 0; rgb.copy(rows, start + 1, y * width * 3, (y +
        1) * width * 3);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, {level: 4})),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function comparePNG(beforeBytes, afterBytes, delta = 36) {
  const a = decodePNG(beforeBytes), b = decodePNG(afterBytes);
  const width = Math.max(a.width, b.width), height =
    Math.max(a.height, b.height);
  const diff = Buffer.allocUnsafe(width * height * 3);
  let changed = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const pos = (y * width + x) * 3;
    const inA = x < a.width && y < a.height, inB = x < b.width && y < b.height;
    const ai = (y * a.width + x) * a.channels, bi = (y * b.width + x) *
      b.channels;
    const mismatch = !inA || !inB ||
      (Math.abs(a.pixels[ai] - b.pixels[bi]) + Math.abs(a.pixels[ai + 1] -
        b.pixels[bi + 1]) + Math.abs(a.pixels[ai + 2] - b.pixels[bi +
          2]) > delta);
    if (mismatch) {
      changed++; diff[pos] = 255; diff[pos + 1] =
        29; diff[pos + 2] = 45;
    }
    else {
      for (let c = 0; c < 3; c++) diff[pos + c] =
        Math.min(255, Math.round(b.pixels[bi + c] * 0.35 + 170));
    }
  }
  return {
    changed,
    percent: Math.round(changed / (width * height) * 100000) / 1000,
    dimensions: [a.width, a.height, b.width, b.height],
    diff: encodeRGB(width, height, diff),
  };
}
