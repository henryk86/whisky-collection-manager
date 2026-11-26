import {t} from '../../i18n/index.js';
import {adjustPhotoPixels} from './adjustments.js';
import {applyMaskStrokes} from './mask-brush.js';
import {MAX_EXPORT_SIDE, MAX_IMAGE_BYTES, canvasFromImage, imageDataFromCanvas, blobFromCanvas, blobAsDataUrl} from './image-io.js';

/**
 * Encodes the raw cutout and adjusted derivative within the upload limits.
 * The transparent base never contains baked-in adjustments.
 * @param {!Object} source Source image, pending cutout and mask strokes.
 * @param {!Object} storedSettings Validated adjustment settings.
 * @return {!Promise<!Object>} Encoded image payload fields and adjustment flag.
 */
export async function encodePhotoExport({image, pendingCutout, maskStrokes}, storedSettings) {
  // Export the current RAW base (original or new transparent cutout) once.
  // No correction gets baked into the saved transparent PNG.
  const hasEdits = Object.values(storedSettings).some(value => value !== 0);
  let cutoutCanvas;
  let cutoutDataUrl = pendingCutout;
  if (maskStrokes.length) {
    cutoutCanvas = canvasFromImage(image, MAX_EXPORT_SIDE);
    const masked = applyMaskStrokes(imageDataFromCanvas(cutoutCanvas), maskStrokes);
    cutoutCanvas.getContext('2d').putImageData(new ImageData(masked.data, masked.width, masked.height), 0, 0);
    cutoutDataUrl = cutoutCanvas.toDataURL('image/png');
    // Keep the PNG within the cutout endpoint's upload limit.
    while (cutoutDataUrl.length > 13000000 && Math.max(cutoutCanvas.width, cutoutCanvas.height) > 800) {
      const smaller = document.createElement('canvas');
      smaller.width = Math.round(cutoutCanvas.width * .8);
      smaller.height = Math.round(cutoutCanvas.height * .8);
      smaller.getContext('2d').drawImage(cutoutCanvas, 0, 0, smaller.width, smaller.height);
      cutoutCanvas = smaller;
      cutoutDataUrl = cutoutCanvas.toDataURL('image/png');
    }
    if (cutoutDataUrl.length > 13000000) throw Error(t('photoEditor.tooLarge'));
  }
  let imageDataUrl;
  if (hasEdits) {
    let canvas = cutoutCanvas || canvasFromImage(image, MAX_EXPORT_SIDE);
    const source = imageDataFromCanvas(canvas);
    const adjusted = adjustPhotoPixels(source, storedSettings);
    canvas.getContext('2d').putImageData(new ImageData(adjusted.data, adjusted.width, adjusted.height), 0, 0);
    let blob = await blobFromCanvas(canvas);
    // Preserve pixels: try modestly stronger compression before ever
    // reducing the actual export dimensions for the 10 MB upload limit.
    for (const quality of [.94, .9, .86]) {
      if (blob.size <= MAX_IMAGE_BYTES) break;
      blob = await blobFromCanvas(canvas, quality);
    }
    while (blob.size > MAX_IMAGE_BYTES && Math.max(canvas.width, canvas.height) > 800) {
      const smaller = document.createElement('canvas');
      smaller.width = Math.round(canvas.width * .8);
      smaller.height = Math.round(canvas.height * .8);
      smaller.getContext('2d').drawImage(canvas, 0, 0, smaller.width, smaller.height);
      canvas = smaller;
      blob = await blobFromCanvas(canvas, .9);
    }
    if (blob.size > MAX_IMAGE_BYTES) throw Error(t('photoEditor.tooLarge'));
    imageDataUrl = await blobAsDataUrl(blob);
  }
  return {hasEdits, cutoutDataUrl, imageDataUrl};
}
