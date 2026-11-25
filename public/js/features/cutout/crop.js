import {t} from '../../i18n/index.js';
/**
 * Pure geometry for isolating and straightening the dominant bottle in a
 * transparent 2:3 PNG.
 */
export const CUTOUT_WIDTH_RATIO = 2;
export const CUTOUT_HEIGHT_RATIO = 3;
const FOREGROUND_ALPHA = 64;
const FEATHER_ALPHA = 8;
// Accept ordinary hand-held photos with moderate bottle tilt; reject
// extreme/ambiguous masks.
const MAX_AUTO_ROTATION = 20 * Math.PI / 180;

/**
 * Validates mask against its constraints.
 *
 * @param {*} mask Value used by this operation.
 * @param {*} maskWidth Value used by this operation.
 * @param {*} maskHeight Value used by this operation.
 * @param {*} sourceWidth Value used by this operation.
 * @param {*} sourceHeight Value used by this operation.
 */
function validateMask(mask, maskWidth, maskHeight, sourceWidth, sourceHeight) {
  if (!mask || mask.length !== maskWidth * maskHeight ||
    !Number.isInteger(maskWidth) || !Number.isInteger(maskHeight)
    || maskWidth < 1 || maskHeight < 1 || !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight)
    || sourceWidth <= 0 || sourceHeight <=
    0) throw new Error(t('errors.cutout.invalidMask'));
}

/**
 * Estimates the bottle tilt from the horizontal centres of silhouette rows.
 * Transparent glass may leave holes in the segmentation mask. Fitting the
 * outer silhouette instead of pixel moments avoids bias from opaque labels and
 * liquid. Each accepted row contributes equally to the fit.
 *
 * @param {!Int32Array} labels Component ID for every mask pixel.
 * @param {number} id Connected-component ID of the selected bottle.
 * @param {number} maskWidth Segmentation-mask width in pixels.
 * @param {number} maskHeight Segmentation-mask height in pixels.
 * @param {number} scaleX Horizontal mask-to-photo scale.
 * @param {number} scaleY Vertical mask-to-photo scale.
 * @return {?number} Rotation in radians, or null for an unreliable contour.
 */
function silhouetteAngle(labels, id, maskWidth, maskHeight, scaleX, scaleY) {
  const left = new Int32Array(maskHeight).fill(maskWidth);
  const right = new Int32Array(maskHeight).fill(-1);
  let first = maskHeight, last = -1, minX = maskWidth, maxX = -1;
  for (let index = 0; index < labels.length; index++) {
    if (labels[index] !== id) continue;
    const y = Math.floor(index / maskWidth), x = index % maskWidth;
    if (x < left[y]) left[y] = x;
    if (x > right[y]) right[y] = x;
    if (y < first) first = y;
    if (y > last) last = y;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  if (last - first < 20 || (last - first + 1) * scaleY < (maxX - minX + 1) *
    scaleX * 1.35)
    return null;

  // Bottle caps and rounded feet produce unstable widths in the first/last
  // rows.
  const trim = Math.floor((last - first + 1) * .08);
  let widestRow = 0;
  for (let y = first; y <= last; y++) widestRow =
    Math.max(widestRow, right[y] - left[y]);
  const minimumWidth = Math.max(2, widestRow * .35);
  let count = 0, sumY = 0, sumX = 0, sumYY = 0, sumXY = 0;
  const rows = [];
  for (let y = first + trim; y <= last - trim; y++) {
    if (right[y] - left[y] < minimumWidth) continue;
    const photoY = (y + .5) * scaleY;
    const photoX = (left[y] + right[y] + 1) * .5 * scaleX;
    rows.push([photoY, photoX]);
    count++; sumY += photoY; sumX += photoX;
    sumYY += photoY * photoY; sumXY += photoX * photoY;
  }
  if (count < 12) return null;
  const meanY = sumY / count, meanX = sumX / count;
  const variance = sumYY / count - meanY * meanY;
  if (variance <= 0) return null;
  const slope = (sumXY / count - meanY * meanX) / variance;
  const intercept = meanX - slope * meanY;
  const meanError = rows.reduce(
    (sum, [y, x]) => sum + Math.abs(x - (intercept + slope * y)),
    0
  ) / count;
  // Large deviations indicate a fragmented, irregular, or non-bottle contour.
  if (meanError > (maxX - minX + 1) * scaleX * .13) return null;
  return Math.atan(slope);
}

/**
 * The model input is square, but rotation must be measured in undistorted
 * PHOTO pixels.
 *
 * @param {!Uint8ClampedArray} mask Pixel values of the segmentation mask.
 * @param {number} maskWidth Width of the segmentation mask in pixels.
 * @param {number} maskHeight Height of the segmentation mask in pixels.
 * @param {number} sourceWidth Width of the source image in pixels.
 * @param {number} sourceHeight Height of the source image in pixels.
 * @return {{mask: !Uint8ClampedArray, crop: !Object, rotation: number,
 *     center: !Object, verticallyTight: boolean, objectWidth: number}}
 *     Isolated mask, crop rectangle in photo pixels, and rotation in radians.
 * @throws {Error} If the mask is invalid or no bottle component is found.
 */
export function analyzeBottleMask(mask, maskWidth, maskHeight, sourceWidth,
  sourceHeight) {
  validateMask(mask, maskWidth, maskHeight, sourceWidth, sourceHeight);
  const labels = new Int32Array(mask.length);
  const queue = new Int32Array(mask.length);
  const components = [];
  const scaleX = sourceWidth / maskWidth;
  const scaleY = sourceHeight / maskHeight;
  for (let start = 0; start < mask.length; start++) {
    if (labels[start] || mask[start] < FOREGROUND_ALPHA) continue;
    const id = components.length + 1;
    let front = 0;
    let back = 1;
    queue[0] = start;
    labels[start] = id;
    let sumX = 0, sumY = 0, sumXX = 0, sumYY = 0, sumXY = 0;
    while (front < back) {
      const index = queue[front++];
      const x = index % maskWidth, y = Math.floor(index / maskWidth);
      const photoX = (x + .5) * scaleX, photoY = (y + .5) * scaleY;
      sumX += photoX; sumY += photoY;
      sumXX += photoX * photoX; sumYY += photoY * photoY; sumXY +=
        photoX * photoY;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= maskHeight) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if ((!dx && !dy) || nx < 0 || nx >= maskWidth) continue;
          const neighbor = ny * maskWidth + nx;
          if (!labels[neighbor] && mask[neighbor] >= FOREGROUND_ALPHA) {
            labels[neighbor] = id;
            queue[back++] = neighbor;
          }
        }
      }
    }
    const cx = sumX / back, cy = sumY / back;
    components.push({
      id, area: back, cx, cy,
      xx: sumXX / back - cx * cx,
      yy: sumYY / back - cy * cy,
      xy: sumXY / back - cx * cy,
    });
  }
  const largest = components.reduce(
    (winner, item) => !winner || item.area > winner.area ? item : winner,
    null
  );
  if (!largest || largest.area < Math.max(4, Math.floor(mask.length / 10000)))
    throw new Error(t('errors.cutout.noBottle'));

  // Prefer a substantial connected component near the photo centre, not an edge
  // artifact.
  // If the photographed bottle is off-centre, fall back to the largest
  // component.
  const centered = components.filter(item => item.area >= largest.area * .2
    && Math.abs(item.cx / sourceWidth - .5) <= .27
    && Math.abs(item.cy / sourceHeight - .5) <= .3);
  const selected = centered.length
    ? centered.reduce(
      (winner, item) => !winner || item.area > winner.area ? item : winner,
      null
    )
    : largest;

  const isolatedMask = new Uint8ClampedArray(mask.length);
  for (let index = 0; index < mask.length; index++) {
    if (labels[index] === selected.id) isolatedMask[index] = mask[index];
  }
  // One-pixel antialias fringe around the selected component; never retain
  // other islands.
  for (let index = 0; index < mask.length; index++) {
    if (labels[index] !== selected.id) continue;
    const x = index % maskWidth, y = Math.floor(index / maskWidth);
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= maskHeight) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        if (nx < 0 || nx >= maskWidth) continue;
        const neighbor = ny * maskWidth + nx;
        if (!labels[neighbor] && mask[neighbor] >=
          FEATHER_ALPHA) isolatedMask[neighbor] = mask[neighbor];
      }
    }
  }

  // Use silhouette-centre regression for hollow/transparent bottles. Pixel
  // moments
  // remain a fallback for incomplete outlines. Neither rotates near-square
  // objects.
  const principalAngle = .5 * Math.atan2(2 * selected.xy, selected.yy -
    selected.xx);
  const anisotropy = Math.hypot(selected.yy - selected.xx, 2 * selected.xy)
    / Math.max(1, selected.xx + selected.yy);
  const elongated = anisotropy > .2 && selected.yy > selected.xx * 1.15;
  const contourAngle = elongated
    ? silhouetteAngle(
      labels,
      selected.id,
      maskWidth,
      maskHeight,
      scaleX,
      scaleY
    ) : null;
  const rotation = contourAngle !== null && Math.abs(contourAngle) <=
    MAX_AUTO_ROTATION
    ? contourAngle
    : elongated && Math.abs(principalAngle) <= MAX_AUTO_ROTATION ?
      principalAngle : 0;
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  const halfX = (Math.abs(cos) * scaleX + Math.abs(sin) * scaleY) / 2;
  const halfY = (Math.abs(sin) * scaleX + Math.abs(cos) * scaleY) / 2;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (let index = 0; index < isolatedMask.length; index++) {
    if (isolatedMask[index] < FEATHER_ALPHA) continue;
    const x = ((index % maskWidth) + .5) * scaleX - selected.cx;
    const y = (Math.floor(index / maskWidth) + .5) * scaleY - selected.cy;
    const rotatedX = selected.cx + x * cos - y * sin;
    const rotatedY = selected.cy + x * sin + y * cos;
    left = Math.min(left, rotatedX - halfX);
    top = Math.min(top, rotatedY - halfY);
    right = Math.max(right, rotatedX + halfX);
    bottom = Math.max(bottom, rotatedY + halfY);
  }
  const objectWidth = right - left;
  const objectHeight = bottom - top;
  const width = Math.max(
    objectWidth,
    objectHeight * CUTOUT_WIDTH_RATIO / CUTOUT_HEIGHT_RATIO
  );
  const height = width * CUTOUT_HEIGHT_RATIO / CUTOUT_WIDTH_RATIO;
  const crop = {
    x: (left + right - width) / 2,
    y: (top + bottom - height) / 2,
    width,
    height,
  };
  return {
    mask: isolatedMask,
    crop,
    rotation,
    center: {x: selected.cx, y: selected.cy},
    verticallyTight: objectWidth <= objectHeight * CUTOUT_WIDTH_RATIO /
      CUTOUT_HEIGHT_RATIO + 1e-6,
    objectWidth,
  };
}

/**
 * Compatibility helper for callers that only need the output crop.
 *
 * @param {!Uint8ClampedArray} mask Pixel values of the segmentation mask.
 * @param {number} maskWidth Width of the segmentation mask in pixels.
 * @param {number} maskHeight Height of the segmentation mask in pixels.
 * @param {number} sourceWidth Width of the source image in pixels.
 * @param {number} sourceHeight Height of the source image in pixels.
 * @return {!Object} Structured result for the caller.
 */
export function bottleCropRect(mask, maskWidth, maskHeight, sourceWidth,
  sourceHeight) {
  return analyzeBottleMask(mask, maskWidth, maskHeight, sourceWidth,
    sourceHeight).crop;
}

/**
 * Output dimensions preserve an exact 2:3 ratio (without needless upscaling).
 *
 * @param {*} crop Crop used by this operation.
 * @param {number} maxSide Max side used by this operation.
 * @return {!Object} Structured result for the caller.
 */
export function cutoutOutputSize(crop, maxSide) {
  if (!(crop?.height > 0) || !(maxSide >
    0)) throw new Error(t('errors.images.invalidCrop'));
  const width = Math.max(
    2,
    Math.floor(Math.min(crop.height, maxSide) / CUTOUT_HEIGHT_RATIO) *
    CUTOUT_WIDTH_RATIO
  );
  return {width, height: width * CUTOUT_HEIGHT_RATIO / CUTOUT_WIDTH_RATIO};
}

/**
 * Visible vertical bounds of a rasterized alpha mask; both endpoints are
 * inclusive.
 *
 * @param {*} rgba Rgba used by this operation.
 * @param {number} width Width in pixels.
 * @param {number} height Height in pixels.
 * @param {number=} minAlpha Minimum alpha value considered visible.
 * @return {?Object} Calculated numeric result.
 */
export function visibleAlphaRows(rgba, width, height, minAlpha = FEATHER_ALPHA
) {
  if (!rgba || rgba.length !== width * height *
    4) throw new Error(t('errors.images.invalidData'));
  let first = height, last = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] < minAlpha) continue;
      first = Math.min(first, y);
      last = y;
      break;
    }
  }
  return last < 0 ? null : {top: first, bottom: last};
}

/**
 * Reframe a rendered mask, never clip its sides simply to remove a vertical
 * margin.
 *
 * @param {*} crop Crop used by this operation.
 * @param {number} size Size of the input or target.
 * @param {boolean} visible Visible used by this operation.
 * @param {*} objectWidth Object width used by this operation.
 * @return {*} Structured result assembled from the input data.
 */
export function tightenedCrop(crop, size, visible, objectWidth) {
  if (!visible || (visible.top === 0 && visible.bottom === size.height -
    1)) return crop;
  const scale = crop.height / size.height;
  const height = (visible.bottom - visible.top + 1) * scale;
  const width = height * CUTOUT_WIDTH_RATIO / CUTOUT_HEIGHT_RATIO;
  if (width + 1e-6 < objectWidth) return crop;
  return {
    x: crop.x + (crop.width - width) / 2,
    y: crop.y + visible.top * scale, width, height,
  };
}
