/**
 * Pure viewport transforms. Zoom affects only the on-screen canvas, never
 * exported pixels.
 */
export const MIN_PREVIEW_ZOOM = 1;
export const MAX_PREVIEW_ZOOM = 6;
/**
 * Limits photo-preview zoom to its supported range.
 *
 * @param {*} value Input value to process.
 * @return {number} Calculated numeric result.
 */
export const clampPreviewZoom = value =>
  Math.max(MIN_PREVIEW_ZOOM, Math.min(MAX_PREVIEW_ZOOM, value));

/**
 * Adjusts zoom while keeping the chosen image point stationary.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @param {*} requestedZoom New zoom level requested by the user.
 * @param {*} point Point used by this operation.
 * @param {number} size Size of the input or target.
 * @return {!Object} Structured result for the caller.
 */
export function zoomAroundPoint({zoom, x, y}, requestedZoom, point, size) {
  const nextZoom = clampPreviewZoom(requestedZoom);
  const ratio = nextZoom / zoom;
  const nextX = point.x - size.width / 2 - (point.x - size.width / 2 -
    x) * ratio;
  const nextY = point.y - size.height / 2 - (point.y - size.height / 2 -
    y) * ratio;
  return constrainPreviewPan({zoom: nextZoom, x: nextX, y: nextY}, size);
}

/**
 * Constrains the preview translation to keep the image in bounds.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @param {number} size Size of the input or target.
 * @return {!Object} Structured result for the caller.
 */
export function constrainPreviewPan({zoom, x, y}, size) {
  const widthLimit = (zoom - 1) * size.width / 2;
  const heightLimit = (zoom - 1) * size.height / 2;
  return {
    zoom,
    x: Math.max(-widthLimit, Math.min(widthLimit, x)),
    y: Math.max(-heightLimit, Math.min(heightLimit, y)),
  };
}
