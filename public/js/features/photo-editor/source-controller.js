import {t} from '../../i18n/index.js';
import {imageUrl} from '../../ui/format.js';
import {toast} from '../../ui/notifications.js';
import {request} from '../../api.js';
import {cutoutImage} from '../cutout/image.js';
import {adjustPhotoPixels, EMPTY_PHOTO_ADJUSTMENTS} from './adjustments.js';
import {applyMaskStrokes} from './mask-brush.js';
import {canvasFromImage, imageDataFromCanvas, clonePixels, MAX_PREVIEW_SIDE} from './image-io.js';

/**
 * Manages transparent source generation, selection and removal for the current draft.
 * @param {!Object} options Session, modal operations and preview callbacks.
 * @return {!Object} Cutout source operations.
 */
export function createPhotoSources({session, root, findPhoto, syncSliders, stopPicking, stopBrush, resetViewport, showPreviewNow, schedulePreview, action, closeModal}) {
  /**
   * Updates the DOM elements managed by cutout.
   * @return {!Promise<*>} Completion of local bottle segmentation and preview preparation.
   */
  async function cutout() {
    if (session.busy || !session.selection || !session.sourceData || !root()) return;
    const photo = findPhoto(session.selection.bottleId, session.selection.photoId);
    if (!photo) return;
    session.busy = true;
    stopPicking();
    syncSliders();
    const thisGeneration = session.generation;
    const message = root().querySelector('[data-photo-editor-message]');
    try {
      const originalUrl = imageUrl(photo.path);
      let segmentationUrl;
      if (Object.values(session.values).some(value => value !== 0)) {
        const original = new Image();
        original.decoding = 'async';
        original.crossOrigin = 'anonymous';
        original.src = originalUrl;
        await original.decode();
        const sourceCanvas = canvasFromImage(original, MAX_PREVIEW_SIDE);
        const corrected = adjustPhotoPixels(imageDataFromCanvas(sourceCanvas), session.values);
        sourceCanvas.getContext('2d').putImageData(new ImageData(corrected.data, corrected.width, corrected.height),
          0,
          0
        );
        segmentationUrl = sourceCanvas.toDataURL('image/png');
      }
      const cutoutData = await cutoutImage(originalUrl, phase => {
        if (session.generation === thisGeneration && root()) message.textContent = t(`cutout.${phase}`);
      }, {segmentationUrl});
      if (session.generation !== thisGeneration || !root()) return;
      const cutoutImageElement = new Image();
      cutoutImageElement.src = cutoutData;
      await cutoutImageElement.decode();
      if (session.generation !== thisGeneration || !root()) return;
      session.pendingCutout = cutoutData;
      // Retain the uncropped original for immediate before/after comparison.
      if (!session.previewCutout) session.originalPreviewData = session.sourceData;
      session.previewCutout = true;
      session.sourceValues.cutout = {...session.values};
      session.savedSourceValues.cutout = {...EMPTY_PHOTO_ADJUSTMENTS};
      session.cutoutMaskStrokes = [];
      session.maskStrokes = []; stopBrush();
      session.image = cutoutImageElement;
      const canvas = canvasFromImage(session.image, MAX_PREVIEW_SIDE);
      session.sourceData = imageDataFromCanvas(canvas);
      session.maskBaseData = imageDataFromCanvas(canvas);
      const preview = root().querySelector('[data-photo-editor-preview]');
      preview.width = canvas.width;
      preview.height = canvas.height;
      session.showingBefore = false;
      resetViewport();
      showPreviewNow();
      message.textContent = t('photoEditor.cutoutReady');
    } catch (error) {
      if (session.generation === thisGeneration && root()) {
        message.textContent = t('cutout.failed');
        toast(`${t('cutout.failed')}: ${error.message}`, true);
      }
    } finally {
      if (session.generation === thisGeneration) {
        session.busy = false;
        if (root()) syncSliders();
      }
    }
  }

  /**
   * Controls cutout for controller.
   */
  function toggleCutout() {
    const photo = session.selection && findPhoto(session.selection.bottleId, session.selection.photoId);
    if (!photo?.cutout || session.busy || session.pendingCutout || !root()) return;
    const next = !session.previewCutout;
    const key = next ? 'cutout' : 'original';
    if (!session.sourceImages[key] || !session.sourcePixels[key]) return;
    stopPicking();
    stopBrush();
    if (session.previewCutout) session.cutoutMaskStrokes = session.maskStrokes.map(stroke => ({...stroke}));
    session.sourceValues[session.previewCutout ? 'cutout' : 'original'] = {...session.values};
    session.image = session.sourceImages[key];
    session.maskBaseData = next ? clonePixels(session.sourcePixels.cutout) : null;
    session.maskStrokes = next ? session.cutoutMaskStrokes.map(stroke => ({...stroke})) : [];
    session.sourceData = next && session.maskStrokes.length ? applyMaskStrokes(session.maskBaseData, session.maskStrokes) : clonePixels(session.sourcePixels[key]);
    session.previewCutout = next;
    session.values = {...session.sourceValues[key]};
    session.showingBefore = false;
    resetViewport();
    showPreviewNow();
    root().querySelector('[data-photo-editor-message]').textContent = t('photoEditor.hint');
    syncSliders();
  }

  /**
   * Clears cutout for controller.
   */
  async function removeCutout() {
    const photo = session.selection && findPhoto(session.selection.bottleId, session.selection.photoId);
    if (!photo || session.busy || !root()) return;
    if (session.pendingCutout) {
      session.busy = true;
      syncSliders();
      const thisGeneration = session.generation;
      try {
        const original = new Image();
        original.crossOrigin = 'anonymous';
        original.decoding = 'async';
        original.src = imageUrl(photo.path);
        await original.decode();
        if (thisGeneration !== session.generation || !root()) return;
        session.image = original;
        const canvas = canvasFromImage(original, MAX_PREVIEW_SIDE);
        session.sourceData = imageDataFromCanvas(canvas);
        const preview = root().querySelector('[data-photo-editor-preview]');
        preview.width = canvas.width;
        preview.height = canvas.height;
        session.pendingCutout = null;
        session.previewCutout = false;
        session.values = {...session.sourceValues.original};
        session.maskBaseData = null; session.maskStrokes = []; session.cutoutMaskStrokes = []; stopBrush();
        session.showingBefore = false;
        root().querySelector('[data-photo-editor-message]').textContent = t('cutout.removed');
        resetViewport();
        schedulePreview();
      } catch (error) {
        toast(error.message, true);
      } finally {
        session.busy = false;
        if (root()) syncSliders();
      }
      return;
    }
    if (!photo.cutout) return;
    const result = await action(() => request(
      `/api/bottles/${encodeURIComponent(session.selection.bottleId)}/photos/${encodeURIComponent(session.selection.photoId)}/cutout`,
      {method: 'DELETE'}
    ));
    if (result.ok) {session.generation++; closeModal(true); toast(t('cutout.removed'));}
  }

  return {cutout, toggleCutout, removeCutout};
}
