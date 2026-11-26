import {renderPhotoEditor, syncPhotoEditorControls} from './presentation.js';
import {createPhotoEditorSession, createPhotoDraft, createPhotoControlsModel} from './view-model.js';
import {createPhotoTools} from './tools-controller.js';
import {createPhotoPreview} from './preview-controller.js';
import {createPhotoSources} from './source-controller.js';
import {createPhotoSave} from './save-controller.js';
import {MAX_PREVIEW_SIDE, canvasFromImage, imageDataFromCanvas, clonePixels, loadSourceImage} from './image-io.js';

import {t} from '../../i18n/index.js';

import {imageUrl} from '../../ui/format.js';

import {toast} from '../../ui/notifications.js';
import {
  PHOTO_ADJUSTMENT_GROUPS, EMPTY_PHOTO_ADJUSTMENTS,
  autoPhotoAdjustments, validatePhotoAdjustments, resetPhotoAdjustmentGroup
} from './adjustments.js';
import {createPhotoViewport} from './viewport-controller.js';
import {DEFAULT_MASK_BRUSH_SIZE} from './mask-brush.js';

/**
 * Finds the currently mounted photo-editor host.
 * @return {*} Matching DOM element, if present.
 */
const root = () => document.querySelector('[data-photo-editor]');


/**
 * All edits are previewed against the original unedited source, never
 * cumulatively.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!Object} Photo-editor lifecycle, preview, adjustment, brush and save operations.
 */
export function createPhotoEditor({state, showModal, closeModal, action}) {
  const session = createPhotoEditorSession();
  const {zoom, attachViewport, resetViewport} = createPhotoViewport({
    root,
    /**
     * Reports whether source pixels are ready for preview interaction.
     * @return {boolean} Whether magnification is enabled.
     */
    canZoom: () => Boolean(session.sourceData) && !session.busy,
    /**
     * Prevents panning from competing with editing tools.
     * @return {boolean} Whether pointer panning is enabled.
     */
    canPan: () => Boolean(session.sourceData) && !session.busy && !session.whitePicking && !session.brushMode,
    /**
     * Reports whether the white-balance pipette is active.
     * @return {boolean} Whether the pipette owns the pointer.
     */
    picking: () => session.whitePicking,
  });
  /**
   * Selects photo matching the input.
   *
   * @param {string} bottleId Identifier of the physical bottle containing the photo.
   * @param {string} photoId Identifier of the photo within that bottle.
   * @return {*} Matching photo of the specified physical bottle, or undefined if absent.
   */
  const findPhoto = (bottleId, photoId) => state.collection?.bottlings.flatMap(bottling => bottling.bottles || []).find(bottle => bottle.id === bottleId)?.photos?.find(photo =>
    photo.id === photoId);

  /**
   * Produces the endpoint text used by the caller.
   * @return {string} Relative API URL for adjustments to the selected bottle photo.
   */
  const endpoint = () =>
    `/api/bottles/${encodeURIComponent(session.selection.bottleId)}/photos/${encodeURIComponent(session.selection.photoId)}/adjustments`;

  /** Updates mounted controls from the current draft and saved photo. */
  function syncSliders() {
    const photo = session.selection && findPhoto(session.selection.bottleId, session.selection.photoId);
    syncPhotoEditorControls(root(), createPhotoControlsModel(session, photo));
  }

  const {schedulePreview, showPreviewNow} = createPhotoPreview({session, root});
  const {stopPicking, stopBrush, toggleWhitePicker, toggleBrush, undoBrush, attachWhitePicker, attachMaskBrush} = createPhotoTools({session, root, setValues, syncSliders, schedulePreview});
  const {cutout, toggleCutout, removeCutout} = createPhotoSources({session, root, findPhoto, syncSliders, stopPicking, stopBrush, resetViewport, showPreviewNow, schedulePreview, action, closeModal});
  const save = createPhotoSave({session, root, findPhoto, endpoint, syncSliders, action, closeModal});


  /**
   * Selects tab matching the input.
   *
   * @param {string} tab Editor tab key, either adjustments or cutout.
   */
  function selectTab(tab) {
    if (tab !== 'adjustments' && tab !== 'cutout') return;
    session.activeTab = tab;
    if (tab !== 'adjustments') stopPicking();
    if (tab !== 'cutout') stopBrush();
    syncSliders();
  }

  /**
   * Controls the controller state.
   *
   * @param {*} button Photo action control carrying the bottle and photo identifiers.
   */
  async function open(button) {
    const bottleId = button?.dataset.id;
    const photoId = button?.dataset.photoId;
    const photo = findPhoto(bottleId, photoId);
    if (!photo) return;
    Object.assign(session, createPhotoDraft(photo, bottleId, photoId));
    session.cutoutMaskStrokes = [];
    session.sourceData = null;
    session.originalPreviewData = null;
    session.sourceImages = {original: null, cutout: null};
    session.sourcePixels = {original: null, cutout: null};
    session.image = null;
    session.pendingCutout = null;
    session.maskBaseData = null; session.maskStrokes = []; session.brushMode = null; session.brushSize = DEFAULT_MASK_BRUSH_SIZE; session.activeBrush = null;
    session.busy = false;
    session.whitePicking = false;
    session.pickStart = null;
    session.showingBefore = false;
    session.activeTab = 'adjustments';
    resetViewport(false);
    session.generation++;
    const currentGeneration = session.generation;
    if (session.renderId) cancelAnimationFrame(session.renderId);
    showModal(
      t('photoEditor.title'),
      renderPhotoEditor(photo),
      true,
      Boolean(state.modal),
      '',
      'editor'
    );
    const host = root();
    host.addEventListener('input', event => {
      if (event.target.matches('[data-photo-brush-size]')) {
        session.brushSize = Number(event.target.value);
        syncSliders();
        return;
      }
      const input = event.target.closest('[data-photo-slider]');
      if (!input || session.busy) return;
      session.values[input.dataset.photoSlider] = Number(input.value);
      session.sourceValues[session.previewCutout ? 'cutout' : 'original'] = {...session.values};
      session.showingBefore = false;
      stopPicking();
      syncSliders();
      schedulePreview();
    });
    host.addEventListener('keydown', event => {
      const tab = event.target.closest('[data-photo-editor-tab]');
      if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const next = event.key === 'Home' ? 'adjustments' : event.key === 'End' ? 'cutout' : (tab.dataset.photoEditorTab === 'adjustments' ? 'cutout' : 'adjustments');
        selectTab(next);
        host.querySelector(`[data-photo-editor-tab="${next}"]`)?.focus();
        return;
      }
      if (event.key === 'Escape' && (session.whitePicking || session.brushMode)) {
        event.stopPropagation();
        stopPicking();
        stopBrush();
        syncSliders();
        host.querySelector('[data-photo-editor-message]').textContent = t('photoEditor.hint');
      }
    });
    attachWhitePicker(host.querySelector('[data-photo-editor-preview]'));
    attachMaskBrush(host.querySelector('[data-photo-editor-preview]'));
    attachViewport(host.querySelector('[data-photo-editor-preview]'));
    try {
      // Preload *both* saved sources. Source selection is a purely local
      // preview operation and must be immediate once the editor is ready.
      const [originalImage, cutoutImage] = await Promise.all([
        loadSourceImage(photo.path),
        photo.cutout?.path ? loadSourceImage(photo.cutout.path) : Promise.resolve(null),
      ]);
      if (currentGeneration !== session.generation || !root()) return;
      session.sourceImages = {original: originalImage, cutout: cutoutImage};
      session.sourcePixels = {
        original: imageDataFromCanvas(canvasFromImage(originalImage, MAX_PREVIEW_SIDE)),
        cutout: cutoutImage ? imageDataFromCanvas(canvasFromImage(cutoutImage, MAX_PREVIEW_SIDE)) : null,
      };
      session.originalPreviewData = session.sourcePixels.original;
      const sourceKey = session.previewCutout ? 'cutout' : 'original';
      session.image = session.sourceImages[sourceKey];
      session.sourceData = clonePixels(session.sourcePixels[sourceKey]);
      session.maskBaseData = session.previewCutout ? clonePixels(session.sourcePixels.cutout) : null;
      const preview = root().querySelector('[data-photo-editor-preview]');
      preview.width = session.sourceData.width;
      preview.height = session.sourceData.height;
      showPreviewNow();
      root().querySelector('[data-photo-editor-message]').textContent = t('photoEditor.hint');
      syncSliders();
      resetViewport();

    } catch (error) {
      if (currentGeneration !== session.generation || !root()) return;
      root().querySelector('[data-photo-editor-message]').textContent = t('photoEditor.error');
      toast(error.message, true);
    }
  }

  /**
   * Normalizes photo adjustments, stores them for the active source and refreshes controls and preview.
   *
   * @param {*} next Next candidate state or entry.
   */
  function setValues(next) {
    if (!root() || session.busy || !session.sourceData) return;
    session.values = validatePhotoAdjustments(next);
    session.sourceValues[session.previewCutout ? 'cutout' : 'original'] = {...session.values};
    stopPicking();
    session.showingBefore = false;
    syncSliders();
    schedulePreview();
  }

  /**
   * Restores the default photo-adjustment values.
   */
  function reset() {setValues(EMPTY_PHOTO_ADJUSTMENTS);}

  /**
   * Removes or resets group.
   *
   * @param {string} groupKey Adjustment group whose slider values are reset.
   */
  function resetGroup(groupKey) {
    if (!PHOTO_ADJUSTMENT_GROUPS.some(group => group.key === groupKey)) return;
    setValues(resetPhotoAdjustmentGroup(session.values, groupKey));
  }

  /**
   * Calculates automatic adjustments from the current source pixels and applies them.
   */
  function auto() {if (session.sourceData) setValues(autoPhotoAdjustments(session.sourceData));}

  /**
   * Prepares the controller state.
   */
  async function before() {
    if (!root() || !session.sourceData || session.busy) return;
    if (session.showingBefore) {
      session.showingBefore = false;
      showPreviewNow();
      syncSliders();
      return;
    }
    stopPicking();
    stopBrush();
    if (session.previewCutout && !session.originalPreviewData) {
      const photo = session.selection && findPhoto(session.selection.bottleId, session.selection.photoId);
      if (!photo) return;
      const thisGeneration = session.generation;
      session.busy = true;
      syncSliders();
      try {
        const original = new Image();
        original.decoding = 'async';
        original.crossOrigin = 'anonymous';
        original.src = imageUrl(photo.path);
        if (typeof original.decode === 'function') await original.decode();
        else await new Promise((resolve, reject) => {
          original.onload = resolve; original.onerror = reject;
        });
        if (session.generation !== thisGeneration || !root()) return;
        session.originalPreviewData = imageDataFromCanvas(canvasFromImage(original, MAX_PREVIEW_SIDE));
      } catch (error) {
        if (session.generation === thisGeneration && root()) toast(error.message, true);
        return;
      } finally {
        if (session.generation === thisGeneration) {
          session.busy = false;
          if (root()) syncSliders();
        }
      }
    }
    if (!root()) return;
    session.showingBefore = true;
    showPreviewNow();
    syncSliders();
  }

  return {
    open,
    selectTab,
    before,
    auto,
    reset,
    resetGroup,
    toggleWhitePicker,
    toggleBrush,
    undoBrush,
    zoom,
    cutout,
    toggleCutout,
    removeCutout,
    save,
  };
}
