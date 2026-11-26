import {insuranceInventory, evidenceKeys} from '../../domain/insurance.js';
import {currentLanguage, t} from '../../i18n/index.js';
import {httpResponseError} from '../../api.js';
import {TextPdf, wrapReportText} from './pdf.js';
import {EvidenceArchive} from './archive.js';

/**
 * Downloads one authenticated, same-origin resource without external requests.
 * @param {string} url Local image or attachment endpoint.
 * @return {Promise<Blob>} Original resource bytes.
 */
async function resource(url) {
  const response = await fetch(url, {credentials: 'same-origin', cache: 'no-store'});
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('wcm:auth-required'));
    throw httpResponseError(response.status, null);
  }
  return response.blob();
}

/**
 * Resolves only validated local original photo paths.
 * @param {string} path Stored image path.
 * @return {string} Same-origin media URL.
 */
function photoUrl(path) {
  if (!/^images\/[\w-]+\/[\w-]+\.(jpg|jpeg|png|webp|gif)$/i.test(path)) throw Error(t('insurance.exportFailed'));
  return `/${path}`;
}

/**
 * Formats a recorded purchase price without currency conversion.
 * @param {number} value Purchase price.
 * @param {string} currency ISO currency code.
 * @return {string} Localized purchase price.
 */
function amount(value, currency) {
  return new Intl.NumberFormat(currentLanguage(), {style: 'currency', currency}).format(value);
}

/**
 * Encodes a white-background photo thumbnail as JPEG.
 * @param {HTMLCanvasElement} canvas Rendered photograph.
 * @return {Promise<Blob>} JPEG thumbnail.
 */
function photoImage(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error(t('insurance.exportFailed'))), 'image/jpeg', 0.92));
}

/**
 * Renders a missing Base-14 grapheme as a reusable monochrome glyph mask.
 * The PDF maps that glyph back to the original Unicode sequence for text extraction.
 * @param {string} character Unicode grapheme.
 * @param {boolean} bold Font weight.
 * @return {{width: number, height: number, left: number, bottom: number, advance: number, units: number, mask: Uint8Array}} Glyph metrics and packed one-bit mask.
 */
function renderGlyph(character, bold) {
  const units = 96;
  const font = `${bold ? 'bold ' : ''}${units}px Arial, sans-serif`;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  if (!ctx) throw Error(t('insurance.exportFailed'));
  ctx.font = font;
  const metrics = ctx.measureText(character);
  const left = Math.floor(-metrics.actualBoundingBoxLeft) - 2;
  const bottom = Math.floor(-metrics.actualBoundingBoxDescent) - 2;
  const top = Math.ceil(metrics.actualBoundingBoxAscent) + 2;
  const width = Math.max(1, Math.ceil(metrics.actualBoundingBoxRight) - left + 2);
  const height = Math.max(1, top - bottom);
  canvas.width = width; canvas.height = height;
  ctx.font = font;
  ctx.fillStyle = '#000';
  ctx.fillText(character, -left, top);
  const data = ctx.getImageData(0, 0, width, height).data;
  const stride = Math.ceil(width / 8);
  const mask = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] >= 128) mask[y * stride + (x >> 3)] |= 128 >> (x % 8);
    }
  }
  return {width, height, left, bottom, advance: metrics.width, units, mask};
}

/** Lays out native PDF text and original photographs in a paginated report. */
class Report {
  /**
   * Initializes a paginated A4 report with a fixed snapshot time.
   * @param {string} timestamp Snapshot creation time in ISO format.
   */
  constructor(timestamp) {
    this.timestamp = timestamp;
    this.pdf = new TextPdf();
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw Error(t('insurance.exportFailed'));
    this.ctx = ctx;
    this.page = 0;
    this.y = 0;
  }

  /**
   * Flushes the prior page and starts a new A4 page with repeated heading.
   * @return {Promise<void>} New page is ready to receive content.
   */
  async next() {
    if (this.page) await this.flush();
    this.page++;
    this.text(t('insurance.title'), 70, 82, 38, true);
    this.text(`${t('insurance.snapshot')}: ${this.timestamp}`, 70, 122, 24);
    this.text(`WCM | ${this.page}`, 70, 1705, 24);
    this.y = 185;
  }

  /**
   * Adds native PDF text using browser measurements for line layout.
   * @param {string} text Plain report content.
   * @param {number} x Horizontal position in logical pixels.
   * @param {number} y Top-origin baseline.
   * @param {number} size Font size in logical pixels.
   * @param {boolean=} bold Use the heading font.
   */
  text(text, x, y, size, bold = false) {
    this.ctx.font = `${bold ? 'bold ' : ''}${size}px Arial, sans-serif`;
    this.pdf.text(text, x, y, size, bold, value => this.ctx.measureText(value).width, renderGlyph);
  }

  /**
   * Appends one wrapped text paragraph and paginates without truncating long names.
   * @param {string} text Report content.
   * @param {boolean=} bold Use a heading weight.
   * @return {Promise<void>} Content placed on one or more pages.
   */
  async line(text, bold = false) {
    const ctx = this.ctx;
    const font = `${bold ? 'bold ' : ''}26px Arial, sans-serif`;
    ctx.font = font;
    for (const line of wrapReportText(text, 1100, value => ctx.measureText(value).width)) {
      if (this.y > 1630) {await this.next(); ctx.font = font;}
      this.text(line, 70, this.y, 26, bold);
      this.y += 36;
    }
  }

  /**
   * Adds an original-photo thumbnail, keeping the complete image visible.
   * @param {Blob} blob Original image bytes.
   * @return {Promise<void>} Photo placed without modifying the original.
   */
  async photo(blob) {
    const bitmap = await createImageBitmap(blob);
    try {
      const scale = Math.min(540 / bitmap.width, 550 / bitmap.height);
      const w = bitmap.width * scale, h = bitmap.height * scale;
      if (this.y + h > 1620) await this.next();
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.ceil(w));
      canvas.height = Math.max(1, Math.ceil(h));
      const ctx = canvas.getContext('2d', {alpha: false});
      if (!ctx) throw Error(t('insurance.exportFailed'));
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      this.pdf.image(await photoImage(canvas), canvas.width, canvas.height, 70, this.y, w, h);
      this.y += h + 45;
    } finally {bitmap.close();}
  }

  /**
   * Appends the current page and its text and image resources to the PDF.
   * @return {Promise<void>} Page stored in the document.
   */
  async flush() {
    this.pdf.addPage();
  }

  /**
   * Finalizes the report, releasing the large canvas bitmap.
   * @return {Promise<Blob>} PDF download.
   */
  async finish() {
    await this.flush();
    this.canvas.width = 1;
    this.canvas.height = 1;
    return this.pdf.finish();
  }
}

/**
 * Builds a report and, optionally, a ZIP containing every personal original
 * photo and attachment for the exact same inventory snapshot.
 * @param {!Object} state Application snapshot and sample inclusion option.
 * @param {string} format One of summary, detail or zip.
 * @return {Promise<{file: Blob, name: string}>} Completed export; errors abort the entire download.
 */
export async function buildInsuranceExport(state, format) {
  if (!['summary', 'detail', 'zip'].includes(format)) throw Error(t('insurance.exportFailed'));
  const {rows, counts, complete, closed, open, totals} = insuranceInventory(state.collection, state.warehouse, state.insuranceIncludeSamples);
  const timestamp = new Date().toISOString();
  const report = new Report(timestamp);
  const archive = format === 'zip' ? new EvidenceArchive() : null;
  const manifest = [];
  await report.next();
  await report.line(t('insurance.scope'));
  await report.line(t(state.insuranceIncludeSamples ? 'insurance.samplesIncluded' : 'insurance.samplesExcluded'));
  await report.line(t('insurance.evidenceNote'));
  await report.line(`${t('insurance.stock')}: ${rows.length} | ${t('home.status.closed')}: ${closed} | ${t('analytics.inventory.openedStatus')}: ${open}`, true);
  await report.line(`${t('insurance.value')}: ${totals.map(([currency, value]) => amount(value, currency)).join(' / ') || '–'}`);
  await report.line(`${t('insurance.complete')}: ${complete} / ${rows.length}`);
  for (const {key, count} of counts) await report.line(`${t(evidenceKeys[key])}: ${count} / ${rows.length}`);
  const rooms = new Map();
  for (const row of rows) {
    const room = row.place?.room || t('insurance.unassigned');
    rooms.set(room, (rooms.get(room) || 0) + 1);
  }
  await report.line(t('insurance.rooms'), true);
  for (const [room, count] of rooms) await report.line(`${room}: ${count}`);
  if (format !== 'summary') {
    for (const row of rows) {
      await report.next();
      const bottle = row.bottle;
      await report.line(`#${bottle.inventoryNumber || '–'} | ${row.name}`, true);
      await report.line(`${t('forms.bottle.status')}: ${t(bottle.status === 'open' ? 'analytics.inventory.openedStatus' : 'home.status.closed')} | ${bottle.volumeType === 'sample' ? t('analytics.inventory.samples') : t('home.inventory.standardBottles')}`);
      await report.line(`${t('insurance.price')}: ${row.checks.price ? amount(bottle.purchasePrice, bottle.currency) : '–'}`);
      await report.line(`${t('insurance.date')}: ${row.checks.date ? bottle.purchaseDate : '–'}`);
      await report.line(`${t('insurance.volume')}: ${row.volumeMl == null ? '–' : `${row.volumeMl} ml`} | ${t('insurance.abv')}: ${row.abv == null ? '–' : `${row.abv} %`}`);
      await report.line(`${t('forms.bottle.seller')}: ${bottle.merchant || '–'}`);
      await report.line(`${t('insurance.location')}: ${row.place?.label || '–'}`);
      await report.line(`${t('insurance.outstanding')}: ${Object.keys(evidenceKeys).filter(key => !row.checks[key]).map(key => t(evidenceKeys[key])).join(', ') || '–'}`);
      const entry = {bottleId: bottle.id, inventoryNumber: bottle.inventoryNumber, name: row.name, photos: [], documents: []};
      for (const [index, photo] of row.photos.entries()) {
        if (!archive && index > 0) break;
        const blob = await resource(photoUrl(photo.path));
        if (index === 0) await report.photo(blob);
        if (archive) {
          const name = `photos/${bottle.id}/${photo.path.split('/').pop()}`;
          await archive.add(name, blob);
          entry.photos.push(name);
        }
      }
      await report.line(`${t('insurance.photo')}: ${row.photos.length}`);
      for (const file of row.files) {
        await report.line(`${file.purchaseEvidence ? t('insurance.receipt') : t('insurance.otherAttachment')}: ${file.name}`);
        if (archive) {
          const blob = await resource(`/api/bottles/${encodeURIComponent(bottle.id)}/files/${encodeURIComponent(file.id)}`);
          if (blob.size !== file.size) throw Error(t('insurance.exportFailed'));
          // WebCrypto is available on HTTPS and localhost; also preserve the stored hash in the manifest for offline verification.
          if (globalThis.crypto?.subtle) {
            const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
            const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
            if (hash !== file.sha256.toLowerCase()) throw Error(t('insurance.exportFailed'));
          }
          const name = `documents/${bottle.id}/${file.path.split('/').pop()}`;
          await archive.add(name, blob);
          entry.documents.push({name, originalName: file.name, purchaseEvidence: file.purchaseEvidence === true, sha256: file.sha256});
        }
      }
      manifest.push(entry);
    }
  }
  const pdf = await report.finish();
  const name = `WCM-insurance-${timestamp.slice(0, 10)}`;
  if (!archive) return {file: pdf, name: `${name}-${format}.pdf`};
  await archive.add('report.pdf', pdf);
  await archive.add('manifest.json', new Blob([JSON.stringify({timestamp, includeSamples: Boolean(state.insuranceIncludeSamples), bottles: manifest}, null, 2)], {type: 'application/json'}));
  return {file: archive.finish(), name: `${name}.zip`};
}
