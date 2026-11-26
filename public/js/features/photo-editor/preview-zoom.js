/**
 * Pure viewport transforms. Zoom affects only the on-screen canvas, never
 * exported pixels.
 */
export const MIN_PREVIEW_ZOOM = 1;
export const MAX_PREVIEW_ZOOM = 6;

/** @typedef {{zoom: number, x: number, y: number}} PreviewTransform */
/** @typedef {{width: number, height: number}} PreviewSize */
/**
 * Limits photo-preview zoom to its supported range.
 *
 * @param {number} value Requested zoom multiplier.
 * @return {number} Multiplier clamped to the supported range.
 */
export const clampPreviewZoom = value => Math.max(MIN_PREVIEW_ZOOM, Math.min(MAX_PREVIEW_ZOOM, value));

/**
 * Adjusts zoom while keeping the chosen image point stationary.
 *
 * @param {PreviewTransform} options Current zoom and translation in viewport pixels.
 * @param {number} requestedZoom Requested zoom multiplier.
 * @param {{x: number, y: number}} point Anchor position in preview viewport pixels that should remain stationary during zoom.
 * @param {PreviewSize} size Viewport width and height in pixels.
 * @return {PreviewTransform} Zoom and offsets constrained to the visible image bounds.
 */
export function zoomAroundPoint({zoom, x, y}, requestedZoom, point, size) {
  const nextZoom = clampPreviewZoom(requestedZoom);
  const ratio = nextZoom / zoom;
  const nextX = point.x - size.width / 2 - (point.x - size.width / 2 - x) * ratio;
  const nextY = point.y - size.height / 2 - (point.y - size.height / 2 - y) * ratio;
  return constrainPreviewPan({zoom: nextZoom, x: nextX, y: nextY}, size);
}

/**
 * Constrains the preview translation to keep the image in bounds.
 *
 * @param {PreviewTransform} options Current zoom and translation in viewport pixels.
 * @param {PreviewSize} size Viewport width and height in pixels.
 * @return {PreviewTransform} Zoom and offsets constrained to the visible image bounds.
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
