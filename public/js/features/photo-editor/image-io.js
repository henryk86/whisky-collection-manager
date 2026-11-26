import {imageUrl} from '../../ui/format.js';
import {t} from '../../i18n/index.js';

export const MAX_PREVIEW_SIDE = 1050;
export const MAX_EXPORT_SIDE = 4096;
export const MAX_IMAGE_BYTES = 9_400_000; // Allow room for JSON/base64 request overhead.
/**
 * Draws the source photograph to a size-limited canvas.
 *
 * @param {HTMLImageElement} image Decoded photograph to draw at its natural aspect ratio.
 * @param {number} maxSide Maximum canvas side length in pixels; never upscales the image.
 * @return {HTMLCanvasElement} Canvas containing the scaled photograph.
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
 * Reads a copy of all RGBA pixels from the canvas.
 *
 * @param {HTMLCanvasElement} canvas Canvas containing the image to read.
 * @return {ImageData} Independent pixel data for the complete canvas.
 */
export const imageDataFromCanvas = canvas =>
  canvas.getContext('2d', {willReadFrequently: true}).getImageData(0, 0, canvas.width, canvas.height);

/**
 * Copies RGBA pixel storage so editing the result cannot mutate the input.
 *
 * @param {{data: Uint8ClampedArray, width: number, height: number}} pixels Image data to copy.
 * @return {ImageData} Independent image and pixel buffer.
 */
export const clonePixels = pixels => new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height);
// Browsers may return image/png here when WebP encoding is unavailable; the API
// accepts that safe fallback and stores the real extension from the bytes.

/**
 * Encodes the canvas as a WebP image, allowing the browser PNG fallback.
 *
 * @param {HTMLCanvasElement} canvas Canvas to encode.
 * @param {number=} quality WebP encoder quality between zero and one.
 * @return {Promise<Blob>} Encoded image, rejecting if encoding fails.
 */
export const blobFromCanvas = (canvas, quality = .97) =>
  new Promise((resolve, reject) =>
    canvas.toBlob(blob => blob ? resolve(blob) : reject(Error(t('photoEditor.error'))), 'image/webp', quality));

/**
 * Reads an encoded image as a data URL for upload.
 *
 * @param {Blob} blob Binary image data to encode as a data URL.
 * @return {Promise<string>} Data URL, rejecting if the read fails.
 */
export const blobAsDataUrl = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  // readAsDataURL produces a string on successful completion.
  reader.onload = () => resolve(/** @type {string} */(reader.result));
  reader.onerror = () => reject(Error(t('photoEditor.error')));
  reader.readAsDataURL(blob);
});


/**
 * Loads and decodes the stored source image for canvas editing.
 *
 * @param {string} path Stored relative image path.
 * @return {Promise<HTMLImageElement>} Decoded source image, rejecting if loading fails.
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
