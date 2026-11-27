import {t} from '../../i18n/index.js';
/** Alpha-only corrections. Source RGB and source alpha stay immutable. */
export const MASK_BRUSH_MODES = Object.freeze(['erase', 'restore']);
export const DEFAULT_MASK_BRUSH_SIZE = 4;

/** @typedef {{x: number, y: number}} MaskPoint */
/** @typedef {{points: MaskPoint[], size: number, mode: 'erase'|'restore'}} MaskStroke */
/** @typedef {{data: Uint8ClampedArray, width: number, height: number}} MaskImageData */

/**
 * A stroke position/radius is relative to the smaller image side, not the
 * screen zoom.
 *
 * @param {Uint8ClampedArray} current Mutable RGBA pixels to update.
 * @param {Uint8ClampedArray} reference Original RGBA pixels used to restore erased mask areas.
 * @param {number} width Width in pixels.
 * @param {number} height Height in pixels.
 * @param {MaskPoint} from Normalized starting brush point within the image.
 * @param {MaskPoint} to Normalized ending brush point within the image.
 * @param {number} sizePercent Brush diameter as a percentage of the smaller image side.
 * @param {'erase'|'restore'} mode Whether to reduce or restore the original alpha.
 * @return {Uint8ClampedArray} The same pixel buffer, with only its alpha channel modified.
 */
export function paintMaskSegment(current, reference, width, height, from, to,
  sizePercent, mode) {
  if (!MASK_BRUSH_MODES.includes(mode)) throw new RangeError(t('errors.photoEditor.invalidBrushMode'));
  if (!(width > 0 && height > 0) || current.length !== width * height * 4 || reference.length !== current.length)
    throw new RangeError(t('errors.images.invalidDimensions'));
  if (![from?.x, from?.y, to?.x, to?.y, sizePercent].every(Number.isFinite))
    throw new RangeError(t('errors.photoEditor.invalidBrushPosition'));
  const radius = Math.max(.5, Math.min(width, height) * Math.max(.5, Math.min(20, sizePercent)) / 200);
  const x0 = from.x * width, y0 = from.y * height, x1 = to.x * width, y1 = to.y * height;
  const dx = x1 - x0, dy = y1 - y0, distance2 = dx * dx + dy * dy;
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) - radius - 1));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(x0, x1) + radius + 1));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) - radius - 1));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(y0, y1) + radius + 1));
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const px = x + .5, py = y + .5;
    const projection = distance2 ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / distance2)) : 0;
    const d = Math.hypot(px - x0 - projection * dx, py - y0 - projection * dy);
    if (d >= radius) continue;
    const strength = d <= radius * .76 ? 1 : (radius - d) / (radius * .24);
    const offset = (y * width + x) * 4 + 3;
    const initial = reference[offset];
    if (mode === 'erase') current[offset] = Math.min(current[offset], Math.round(initial * (1 - strength)));
    else current[offset] = Math.max(current[offset], Math.round(initial * strength));
  }
  return current;
}

/**
 * Rebuild at any resolution. A restore stroke cannot resurrect pixels removed
 * by the AI mask.
 *
 * @param {MaskImageData} imageData Source RGBA image data, copied before applying the strokes.
 * @param {MaskStroke[]} strokes Ordered brush strokes with normalized points, size and paint mode.
 * @return {{data: Uint8ClampedArray<ArrayBuffer>, width: number, height: number}} New RGBA data in an independent buffer at the original pixel dimensions.
 */
export function applyMaskStrokes(imageData, strokes) {
  const output = new Uint8ClampedArray(imageData.data);
  for (const stroke of strokes) {
    for (let i = 0; i < stroke.points.length; i++) {
      const from = stroke.points[Math.max(0, i - 1)];
      const to = stroke.points[i];
      paintMaskSegment(output, imageData.data, imageData.width, imageData.height, from, to, stroke.size, stroke.mode);
    }
  }
  return {data: output, width: imageData.width, height: imageData.height};
}
