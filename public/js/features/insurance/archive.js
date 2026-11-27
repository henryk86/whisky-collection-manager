const encoder = new TextEncoder();
const crcTable = Array.from({length: 256}, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});

/**
 * Computes the standard ZIP CRC-32 of a byte sequence.
 * @param {Uint8Array} bytes Original file bytes.
 * @return {number} Unsigned CRC-32.
 */
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Builds a portable, uncompressed ZIP without altering the original files. */
export class EvidenceArchive {
  /** Initializes an in-memory ZIP32 directory and its file chunks. */
  constructor() {
    /** @type {BlobPart[]} */
    this.parts = [];
    /** @type {Uint8Array<ArrayBuffer>[]} */
    this.central = [];
    this.offset = 0;
    this.directorySize = 0;
    this.names = new Set();
  }

  /**
   * Adds one file, rejecting invalid paths, duplicate names and oversized archives.
   * @param {string} name Safe relative archive path.
   * @param {Blob} file Unchanged content.
   * @return {Promise<void>} Completes after calculating its checksum.
   */
  async add(name, file) {
    const path = encoder.encode(name);
    if (!name || name.split('/').some(part => !part || part === '.' || part === '..' || /[\\:\x00-\x1f]/.test(part)) || path.length > 65535 || this.names.has(name)) throw Error('Invalid archive entry');
    const localSize = 30 + path.length;
    const centralSize = 46 + path.length;
    if (this.central.length >= 65535 || this.offset + localSize + file.size + this.directorySize + centralSize + 22 > 0x7fffffff) throw Error('ZIP32 export exceeds 2 GiB or 65535 entries');
    const checksum = crc32(new Uint8Array(await file.arrayBuffer()));
    const local = new Uint8Array(localSize), lh = new DataView(local.buffer);
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0x0800, true);
    lh.setUint16(12, 33, true);
    lh.setUint32(14, checksum, true);
    lh.setUint32(18, file.size, true);
    lh.setUint32(22, file.size, true);
    lh.setUint16(26, path.length, true);
    local.set(path, 30);
    const central = new Uint8Array(centralSize), ch = new DataView(central.buffer);
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint16(14, 33, true);
    ch.setUint32(16, checksum, true);
    ch.setUint32(20, file.size, true);
    ch.setUint32(24, file.size, true);
    ch.setUint16(28, path.length, true);
    ch.setUint32(42, this.offset, true);
    central.set(path, 46);
    this.parts.push(local, file);
    this.central.push(central);
    this.names.add(name);
    this.offset += localSize + file.size;
    this.directorySize += centralSize;
  }

  /**
   * Finalizes the ZIP32 central directory.
   * @return {Blob} Portable unencrypted ZIP file.
   */
  finish() {
    const end = new Uint8Array(22), view = new DataView(end.buffer);
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, this.central.length, true);
    view.setUint16(10, this.central.length, true);
    view.setUint32(12, this.directorySize, true);
    view.setUint32(16, this.offset, true);
    return new Blob([...this.parts, ...this.central, end], {type: 'application/zip'});
  }
}
