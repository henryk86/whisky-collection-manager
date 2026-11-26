const encoder = new TextEncoder();

/**
 * Wraps paragraphs at word boundaries, splitting only words wider than a line.
 * @param {string} text Untrusted plain report text.
 * @param {number} width Available horizontal space in pixels.
 * @param {function(string): number} measure Measures text in the current font.
 * @return {string[]} Wrapped lines, without dropping characters from long words.
 */
export function wrapReportText(text, width, measure) {
  const lines = [];
  let line = '';
  for (const word of String(text).trim().split(/\s+/u)) {
    const combined = line ? `${line} ${word}` : word;
    if (measure(combined) <= width) {line = combined; continue;}
    if (line) {lines.push(line); line = '';}
    for (const char of word) {
      if (line && measure(line + char) > width) {lines.push(line); line = '';}
      line += char;
    }
  }
  lines.push(line);
  return lines;
}

/** Assembles a paginated PDF using JPEG page images rendered locally. */
export class ImagePdf {
  /** Creates a PDF object accumulator with a reserved catalogue and page tree. */
  constructor() {
    /** @type {BlobPart[]} */
    this.parts = [];
    this.offsets = [0, 0, 0];
    this.pages = [];
    this.length = 0;
    this.write('%PDF-1.4\n');
  }

  /**
   * Appends PDF syntax or bytes, tracking the exact byte offset.
   * @param {string|Blob} data PDF syntax or binary stream.
   */
  write(data) {
    const bytes = typeof data === 'string' ? encoder.encode(data) : data;
    this.parts.push(bytes);
    this.length += bytes instanceof Blob ? bytes.size : bytes.byteLength;
  }

  /**
   * Starts an indirect PDF object at its recorded byte offset.
   * @param {number} id PDF object number.
   */
  start(id) {
    this.offsets[id] = this.length;
    this.write(`${id} 0 obj\n`);
  }

  /**
   * Adds a rasterized A4 page using a JPEG stream.
   * @param {Blob} jpeg Encoded RGB page image.
   * @param {number} width Image width in pixels.
   * @param {number} height Image height in pixels.
   */
  addPage(jpeg, width, height) {
    const image = this.offsets.length;
    const stream = image + 1;
    const page = image + 2;
    this.start(image);
    this.write(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.size} >>\nstream\n`);
    this.write(jpeg);
    this.write('\nendstream\nendobj\n');
    const command = 'q 595.28 0 0 841.89 0 0 cm /Im0 Do Q\n';
    this.start(stream);
    this.write(`<< /Length ${encoder.encode(command).length} >>\nstream\n${command}endstream\nendobj\n`);
    this.start(page);
    this.write(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${image} 0 R >> >> /Contents ${stream} 0 R >>\nendobj\n`);
    this.pages.push(page);
  }

  /**
   * Writes the page tree and cross-reference table and returns the document.
   * @return {Blob} PDF containing all added pages.
   */
  finish() {
    this.start(1);
    this.write('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    this.start(2);
    this.write(`<< /Type /Pages /Count ${this.pages.length} /Kids [${this.pages.map(id => `${id} 0 R`).join(' ')}] >>\nendobj\n`);
    const xref = this.length;
    this.write(`xref\n0 ${this.offsets.length}\n0000000000 65535 f \n`);
    for (const offset of this.offsets.slice(1)) this.write(`${String(offset).padStart(10, '0')} 00000 n \n`);
    this.write(`trailer\n<< /Size ${this.offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(this.parts, {type: 'application/pdf'});
  }
}
