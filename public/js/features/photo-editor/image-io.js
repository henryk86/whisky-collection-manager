import {imageUrl} from '../../ui/format.js';
import {t} from '../../i18n/index.js';

export const MAX_PREVIEW_SIDE = 1050;
export const MAX_EXPORT_SIDE = 4096;
export const MAX_IMAGE_BYTES = 9_400_000; // Allow room for JSON/base64 request overhead.
/**
 * Builds the localized canvas from image text for the current language.
 *
 * @param {*} image Value used by this operation.
 * @param {*} maxSide Value used by this operation.
 * @return {*} Calculated numeric result.
 */
export const canvasFromImage = (image, maxSide) => {
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d', {willReadFrequently: true});
  if (!context) throw Error(t('photoEditor.error'));
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
};

/**
 * Derives the image data from canvas result from the supplied values.
 *
 * @param {*} canvas Canvas used by the rendering operation.
 * @return {*} Result computed from the supplied inputs.
 */
export const imageDataFromCanvas = canvas =>
  canvas.getContext('2d', {willReadFrequently: true}).getImageData(0, 0, canvas.width, canvas.height);

/**
 * Derives the clone pixels result from the supplied values.
 *
 * @param {*} pixels Value used by this operation.
 * @return {*} Result computed from the supplied inputs.
 */
export const clonePixels = pixels => new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height);
// Browsers may return image/png here when WebP encoding is unavailable; the API
// accepts that safe fallback and stores the real extension from the bytes.

/**
 * Builds the localized blob from canvas text for the current language.
 *
 * @param {*} canvas Canvas used by the rendering operation.
 * @param {number=} quality Value used by this operation.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
export const blobFromCanvas = (canvas, quality = .97) =>
  new Promise((resolve, reject) =>
    canvas.toBlob(blob => blob ? resolve(blob) : reject(Error(t('photoEditor.error'))), 'image/webp', quality));

/**
 * Builds the localized blob as data url text for the current language.
 *
 * @param {*} blob Value used by this operation.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
export const blobAsDataUrl = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(Error(t('photoEditor.error')));
  reader.readAsDataURL(blob);
});


/**
 * Retrieves source image from the available state.
 *
 * @param {*} path Path to the target resource.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
export async function loadSourceImage(path) {
  const loaded = new Image();
  loaded.decoding = 'async';
  loaded.crossOrigin = 'anonymous';
  loaded.src = imageUrl(path);
  if (typeof loaded.decode === 'function') await loaded.decode();
  else await new Promise((resolve, reject) => {
    loaded.onload = resolve; loaded.onerror = reject;
  });
  return loaded;
}
