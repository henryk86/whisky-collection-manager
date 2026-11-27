const encoder = new TextEncoder();

/**
 * Wraps paragraphs at word boundaries, splitting only words wider than a line.
 * @param {string} text Untrusted plain report text.
 * @param {number} width Available horizontal space in pixels.
 * @param {(text: string) => number} measure Measures text in the current font.
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

// PDF Base-14 fonts use Windows-1252, not UTF-8. Explicitly map the extra characters.
const extra = '€\u0000‚ƒ„…†‡ˆ‰Š‹Œ\u0000Ž\u0000\u0000‘’“”•–—˜™š›œ\u0000žŸ';
/**
 * Returns the WinAnsi byte for a single representable character.
 * @param {string} character One Unicode grapheme.
 * @return {number|null} Byte or null for the Unicode fallback font.
 */
function ansi(character) {
  if (character.length !== 1) return null;
  const code = character.charCodeAt(0);
  if (code >= 32 && code <= 126 || code >= 160 && code <= 255) return code;
  const index = extra.indexOf(character);
  return character !== '\0' && index >= 0 ? index + 128 : null;
}

/**
 * Encodes bytes or UTF-16 code units as safe PDF hexadecimal strings.
 * @param {Array<number>|Uint8Array} values Values to encode.
 * @param {number=} digits Number of hex digits per value.
 * @return {string} Hexadecimal data without delimiters.
 */
function hex(values, digits = 2) {
  return Array.from(values, value => value.toString(16).padStart(digits, '0')).join('');
}

/**
 * Delimits an encoded PDF hexadecimal string (not markup).
 * @param {string} value Hexadecimal data.
 * @return {string} PDF hexadecimal string.
 */
function pdfHex(value) {return '<' + value + '>';}

/** @typedef {{width: number, height: number, left: number, bottom: number, advance: number, units: number, mask: Uint8Array}} Glyph */
const WIDTH = 1240;
const HEIGHT = 1754;
const SCALE = 595.28 / WIDTH;

/** Assembles A4 pages with native PDF text, JPEG photographs and Unicode fallback glyphs. */
export class TextPdf {
  /** Reserves the catalogue, page tree and two standard font objects. */
  constructor() {
    /** @type {BlobPart[]} */
    this.parts = [];
    this.offsets = [0, 0, 0, 0, 0];
    this.pages = [];
    this.length = 0;
    this.commands = [];
    this.images = [];
    this.glyphFonts = new Map();
    this.pageFonts = new Map();
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
   * Writes a text stream and allocates a new indirect object number.
   * @param {string} content ASCII PDF commands or mapping data.
   * @return {number} Stream object number.
   */
  stream(content) {
    const id = this.offsets.length;
    this.start(id);
    this.write(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream\nendobj\n`);
    return id;
  }

  /**
   * Registers a reusable Type 3 fallback glyph with an explicit Unicode mapping.
   * The browser supplies only a monochrome glyph mask, never a rasterized page.
   * @param {string} character Unicode grapheme, potentially outside WinAnsi.
   * @param {boolean} bold Font weight.
   * @param {(text: string, bold: boolean) => Glyph} render Local glyph renderer, with its em size in pixels.
   * @return {number} PDF font object number.
   */
  fallback(character, bold, render) {
    const key = `${bold}:${character}`;
    if (this.glyphFonts.has(key)) return this.glyphFonts.get(key);
    const {width, height, left, bottom, advance, units, mask} = render(character, bold);
    const right = left + width, top = bottom + height;
    const proc = this.stream(`${advance} 0 ${left} ${bottom} ${right} ${top} d1\nq ${width} 0 0 ${height} ${left} ${bottom} cm\nBI /W ${width} /H ${height} /IM true /BPC 1 /D [1 0] /F /AHx ID\n${hex(mask)}>\nEI\nQ`);
    const unicode = hex(Array.from({length: character.length}, (_, index) => character.charCodeAt(index)), 4);
    const cmap = this.stream(`/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /WCMUnicode def\n/CMapType 2 def\n1 begincodespacerange\n<01> <01>\nendcodespacerange\n1 beginbfchar\n<01> ${pdfHex(unicode)}\nendbfchar\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`);
    const id = this.offsets.length;
    this.start(id);
    this.write(`<< /Type /Font /Subtype /Type3 /FontBBox [${left} ${bottom} ${right} ${top}] /FontMatrix [${1 / units} 0 0 ${1 / units} 0 0] /CharProcs << /glyph ${proc} 0 R >> /Encoding << /Type /Encoding /Differences [1 /glyph] >> /FirstChar 1 /LastChar 1 /Widths [${advance}] /Resources << >> /ToUnicode ${cmap} 0 R >>\nendobj\n`);
    this.glyphFonts.set(key, id);
    return id;
  }

  /**
   * Adds selectable text at a top-origin baseline in the report's logical pixel coordinates.
   * @param {string} text Plain text, not PDF syntax.
   * @param {number} x Horizontal position.
   * @param {number} y Baseline from the top.
   * @param {number} size Font size in logical pixels.
   * @param {boolean} bold Font weight.
   * @param {(text: string) => number} measure Browser measurement for the selected font.
   * @param {(text: string, bold: boolean) => Glyph} render Unicode glyph fallback.
   */
  text(text, x, y, size, bold, measure, render) {
    const font = bold ? 4 : 3;
    let prefix = '', run = '', bytes = [];
    const segmenter = new Intl.Segmenter(undefined, {granularity: 'grapheme'});
    for (const {segment} of segmenter.segment(text)) {
      const byte = ansi(segment);
      if (byte !== null) {run += segment; bytes.push(byte); continue;}
      if (bytes.length) {
        this.textRun(font, bytes, x + measure(prefix), y, size);
        prefix += run;
        run = ''; bytes = [];
      }
      const glyph = this.fallback(segment, bold, render);
      this.textRun(glyph, [1], x + measure(prefix), y, size);
      prefix += segment;
    }
    if (bytes.length) this.textRun(font, bytes, x + measure(prefix), y, size);
  }

  /**
   * Adds one encoded text run and records its page font resource.
   * @param {number} font PDF font object.
   * @param {number[]} bytes Encoded character bytes.
   * @param {number} x Horizontal position.
   * @param {number} y Top-origin baseline.
   * @param {number} size Logical pixel font size.
   */
  textRun(font, bytes, x, y, size) {
    const name = `F${font}`;
    this.pageFonts.set(name, font);
    this.commands.push(`BT /${name} ${size} Tf 1 0 0 1 ${x.toFixed(3)} ${(HEIGHT - y).toFixed(3)} Tm ${pdfHex(hex(bytes))} Tj ET`);
  }

  /**
   * Adds a photo XObject at its original aspect ratio.
   * @param {Blob} jpeg Encoded RGB photograph thumbnail.
   * @param {number} width JPEG pixel width.
   * @param {number} height JPEG pixel height.
   * @param {number} x Horizontal position in logical pixels.
   * @param {number} y Top-origin position.
   * @param {number} w Display width.
   * @param {number} h Display height.
   */
  image(jpeg, width, height, x, y, w, h) {
    const id = this.offsets.length;
    this.start(id);
    this.write(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.size} >>\nstream\n`);
    this.write(jpeg);
    this.write('\nendstream\nendobj\n');
    const name = `Im${id}`;
    this.images.push(`/${name} ${id} 0 R`);
    this.commands.push(`q ${w} 0 0 ${h} ${x} ${HEIGHT - y - h} cm /${name} Do Q`);
  }

  /** Publishes the current page and resets its per-page resources. */
  addPage() {
    const command = `q ${SCALE} 0 0 ${SCALE} 0 0 cm 0.13 g\n${this.commands.join('\n')}\nQ`;
    const stream = this.stream(command);
    const page = this.offsets.length;
    this.start(page);
    const fonts = Array.from(this.pageFonts, ([name, id]) => `/${name} ${id} 0 R`).join(' ');
    this.write(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << ${fonts} >> /XObject << ${this.images.join(' ')} >> >> /Contents ${stream} 0 R >>\nendobj\n`);
    this.pages.push(page);
    this.commands = []; this.images = []; this.pageFonts.clear();
  }

  /**
   * Writes standard fonts, page tree and cross-reference table.
   * @return {Blob} PDF containing all added pages.
   */
  finish() {
    for (const [id, name] of [[3, 'Helvetica'], [4, 'Helvetica-Bold']]) {
      this.start(Number(id));
      this.write(`<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>\nendobj\n`);
    }
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
