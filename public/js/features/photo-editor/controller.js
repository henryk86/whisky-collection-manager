import {renderPhotoEditor} from './presentation.js';

import {t} from '../../i18n/index.js';

import {imageUrl} from '../../ui/format.js';

import {request} from '../../api.js';
import {toast} from '../../ui/notifications.js';
import {
  PHOTO_ADJUSTMENT_GROUPS, EMPTY_PHOTO_ADJUSTMENTS,
  adjustPhotoPixels, autoPhotoAdjustments, validatePhotoAdjustments,
  resetPhotoAdjustmentGroup, whiteBalanceFromArea
} from './adjustments.js';
import {basePhotoPath, editorPhotoSourceSettings}
  from '../../../../shared/photo-images.js';
import {cutoutImage} from '../cutout/image.js';
import {createPhotoViewport} from './viewport-controller.js';
import {DEFAULT_MASK_BRUSH_SIZE, paintMaskSegment, applyMaskStrokes}
  from './mask-brush.js';

const MAX_PREVIEW_SIDE = 1050;
const MAX_EXPORT_SIDE = 4096;
const MAX_IMAGE_BYTES = 9_400_000; // Allow room for JSON/base64 request overhead.
/**
 * Locates the DOM elements used by root.
 * @return {*} Matching DOM element, if present.
 */
const root = () => document.querySelector('[data-photo-editor]');

/**
 * Derives the form value result from the supplied values.
 *
 * @param {*} value Value to process.
 * @return {string} Resulting text.
 */
const formValue = value => Number(value).toLocaleString('de-DE', {maximumFractionDigits: 2});

/**
 * Builds the localized canvas from image text for the current language.
 *
 * @param {*} image Value used by this operation.
 * @param {*} maxSide Value used by this operation.
 * @return {*} Calculated numeric result.
 */
const canvasFromImage = (image, maxSide) => {
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
const imageDataFromCanvas = canvas =>
  canvas.getContext('2d', {willReadFrequently: true}).getImageData(0, 0, canvas.width, canvas.height);

/**
 * Derives the clone pixels result from the supplied values.
 *
 * @param {*} pixels Value used by this operation.
 * @return {*} Result computed from the supplied inputs.
 */
const clonePixels = pixels => new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height);
// Browsers may return image/png here when WebP encoding is unavailable; the API
// accepts that safe fallback and stores the real extension from the bytes.

/**
 * Builds the localized blob from canvas text for the current language.
 *
 * @param {*} canvas Canvas used by the rendering operation.
 * @param {number=} quality Value used by this operation.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
const blobFromCanvas = (canvas, quality = .97) =>
  new Promise((resolve, reject) =>
    canvas.toBlob(blob => blob ? resolve(blob) : reject(Error(t('photoEditor.error'))), 'image/webp', quality));

/**
 * Builds the localized blob as data url text for the current language.
 *
 * @param {*} blob Value used by this operation.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
const blobAsDataUrl = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(Error(t('photoEditor.error')));
  reader.readAsDataURL(blob);
});

/**
 * All edits are previewed against the original unedited source, never
 * cumulatively.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!Object} Structured result for the caller.
 */
export function createPhotoEditor({state, showModal, closeModal, action}) {
  let selection = null;
  let image = null;
  let sourceData = null;
  let pendingCutout = null;
  let maskBaseData = null; // The unmodified transparent base for undo and restore.
  let maskStrokes = []; // Normalized to image coordinates, independent of preview zoom.
  let brushMode = null;
  let brushSize = DEFAULT_MASK_BRUSH_SIZE;
  let activeBrush = null;
  let values = {...EMPTY_PHOTO_ADJUSTMENTS};
  // Preview source is intentionally local to this dialog. Neither a source
  // switch
  // nor a slider change touches the collection until Save is pressed.
  let previewCutout = false;
  let sourceValues = {
    original: {...EMPTY_PHOTO_ADJUSTMENTS},
    cutout: {...EMPTY_PHOTO_ADJUSTMENTS},
  };
  let savedSourceValues = {
    original: {...EMPTY_PHOTO_ADJUSTMENTS},
    cutout: {...EMPTY_PHOTO_ADJUSTMENTS},
  };
  let cutoutMaskStrokes = [];
  let showingBefore = false;
  let originalPreviewData = null; // Before/after for a cutout always shows the complete original.
  let sourceImages = {
    original: null,
    cutout: null,
  }; // Already decoded, for synchronous source switching.
  let sourcePixels = {original: null, cutout: null};
  let activeTab = 'adjustments';
  let whitePicking = false;
  let pickStart = null;
  let busy = false;
  let renderId = 0;
  let generation = 0;
  const {zoom, attachViewport, resetViewport, updateViewport} = createPhotoViewport({
    root,
    /**
     * Reports whether source pixels are ready for preview interaction.
     * @return {boolean} Whether magnification is enabled.
     */
    canZoom: () => Boolean(sourceData) && !busy,
    /**
     * Prevents panning from competing with editing tools.
     * @return {boolean} Whether pointer panning is enabled.
     */
    canPan: () => Boolean(sourceData) && !busy && !whitePicking && !brushMode,
    /**
     * Reports whether the white-balance pipette is active.
     * @return {boolean} Whether the pipette owns the pointer.
     */
    picking: () => whitePicking,
  });
  /**
   * Selects photo matching the input.
   *
   * @param {*} bottleId Value used by this operation.
   * @param {*} photoId Value used by this operation.
   * @return {*} Result computed from the supplied inputs.
   */
  const findPhoto = (bottleId, photoId) => state.collection?.bottlings.flatMap(bottling => bottling.bottles || []).find(bottle => bottle.id === bottleId)?.photos?.find(photo =>
    photo.id === photoId);

  /**
   * Produces the endpoint text used by the caller.
   * @return {string} Resulting text.
   */
  const endpoint = () =>
    `/api/bottles/${encodeURIComponent(selection.bottleId)}/photos/${encodeURIComponent(selection.photoId)}/adjustments`;

  /**
   * Selects tab matching the input.
   *
   * @param {*} tab Value used by this operation.
   */
  function selectTab(tab) {
    if (tab !== 'adjustments' && tab !== 'cutout') return;
    activeTab = tab;
    if (tab !== 'adjustments') stopPicking();
    if (tab !== 'cutout') stopBrush();
    syncSliders();
  }

  /**
   * Updates the DOM elements managed by sync sliders.
   */
  function syncSliders() {
    const host = root();
    if (!host) return;
    for (const tab of host.querySelectorAll('[data-photo-editor-tab]')) {
      const selected = tab.dataset.photoEditorTab === activeTab;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    for (const panel of host.querySelectorAll('[data-photo-editor-panel]'))
      panel.hidden = panel.dataset.photoEditorPanel !== activeTab;
    for (const input of host.querySelectorAll('[data-photo-slider]')) {
      const value = values[input.dataset.photoSlider];
      input.value = String(value);
      host.querySelector(`[data-photo-output="${input.dataset.photoSlider}"]`).textContent = formValue(value);
      input.disabled = busy || !sourceData;
    }
    for (const button of host.querySelectorAll('[data-photo-editor-ready]'))
      button.disabled = busy || !sourceData;
    const generateButton = host.querySelector('[data-act="photo-editor-cutout"]');
    if (generateButton) generateButton.disabled = busy || !sourceData;
    for (const button of host.querySelectorAll('[data-photo-editor-existing-cutout]')) {
      button.disabled = busy || Boolean(pendingCutout) || !sourceData;
      button.textContent = previewCutout ? t('cutout.showOriginal') : t('cutout.showCutout');
    }
    host.dataset.photoPreviewSource = previewCutout ? 'cutout' : 'original';
    const undoCutout = host.querySelector('[data-act="photo-editor-remove-cutout"]');
    if (undoCutout) {
      const photo = selection && findPhoto(selection.bottleId, selection.photoId);
      undoCutout.hidden = !pendingCutout && !photo?.cutout;
      undoCutout.disabled = busy;
    }
    const picker = host.querySelector('[data-act="photo-editor-pick-white"]');
    if (picker) picker.setAttribute('aria-pressed', String(whitePicking));
    const maskTools = host.querySelector('[data-photo-editor-mask-tools]');
    if (maskTools) {
      maskTools.hidden = !maskBaseData;
      for (const button of maskTools.querySelectorAll('[data-photo-brush-mode]')) {
        button.setAttribute('aria-pressed', String(brushMode === button.dataset.photoBrushMode));
        button.disabled = busy;
      }
      const undo = maskTools.querySelector('[data-act="photo-editor-brush-undo"]');
      if (undo) undo.disabled = busy || !maskStrokes.length;
      const size = maskTools.querySelector('[data-photo-brush-size]');
      if (size) {size.disabled = busy; size.value = String(brushSize);}
      maskTools.querySelector('[data-photo-brush-size-value]').textContent = `${brushSize} %`;
    }
    host.querySelector('.photo-editor-image')?.classList.toggle('is-brushing', Boolean(brushMode));
    host.querySelector('.photo-editor-image')?.classList.toggle('is-picking', whitePicking);
    const before = host.querySelector('[data-act="photo-editor-before"]');
    if (before) {
      before.setAttribute('aria-pressed', String(showingBefore));
      before.textContent = showingBefore ? t('photoEditor.after') : t('photoEditor.before');
    }
  }

  /**
   * Performs the stop picking lifecycle action.
   */
  function stopPicking() {
    whitePicking = false;
    pickStart = null;
    const host = root();
    if (host) {
      host.querySelector('[data-photo-editor-selection]')?.setAttribute('hidden', '');
      host.querySelector('.photo-editor-image')?.classList.remove('is-picking');
    }
  }

  // The CSS canvas box can be larger than its rendered image (object-fit:
  // contain).
  // Translate pointer positions through the actual rendered image rectangle.
  /**
   * Calculates the image geometry numeric value.
   *
   * @param {*} canvas Canvas used by the rendering operation.
   * @return {!Object} Structured result assembled from the input data.
   */
  function imageGeometry(canvas) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / sourceData.width, rect.height / sourceData.height);
    return {
      left: rect.left + (rect.width - sourceData.width * scale) / 2,
      top: rect.top + (rect.height - sourceData.height * scale) / 2,
      width: sourceData.width * scale, height: sourceData.height * scale, scale,
    };
  }

  /**
   * Calculates the image point numeric value.
   *
   * @param {*} canvas Canvas used by the rendering operation.
   * @param {!Event} event Event that triggered this operation.
   * @param {boolean=} clampToImage Value used by this operation.
   * @return {!Object} Computed value, or null when the input has no match.
   */
  function imagePoint(canvas, event, clampToImage = false) {
    const frame = imageGeometry(canvas);
    const x = (event.clientX - frame.left) / frame.scale;
    const y = (event.clientY - frame.top) / frame.scale;
    if (!clampToImage && (x < 0 || y < 0 || x > sourceData.width || y > sourceData.height)) return null;
    return {
      x: Math.max(0, Math.min(sourceData.width, x)),
      y: Math.max(0, Math.min(sourceData.height, y)),
    };
  }

  /**
   * Locates the DOM elements used by mark selection.
   *
   * @param {*} canvas Canvas used by the rendering operation.
   * @param {*} start Value used by this operation.
   * @param {*} end Value used by this operation.
   */
  function markSelection(canvas, start, end) {
    const host = root();
    if (!host) return;
    const overlay = host.querySelector('[data-photo-editor-selection]');
    const parent = host.querySelector('.photo-editor-image').getBoundingClientRect();
    const frame = imageGeometry(canvas);
    overlay.style.left = `${frame.left - parent.left + Math.min(start.x, end.x) * frame.scale}px`;
    overlay.style.top = `${frame.top - parent.top + Math.min(start.y, end.y) * frame.scale}px`;
    overlay.style.width = `${Math.max(2, Math.abs(end.x - start.x) * frame.scale)}px`;
    overlay.style.height = `${Math.max(2, Math.abs(end.y - start.y) * frame.scale)}px`;
    overlay.removeAttribute('hidden');
  }

  /**
   * Registers white picker for controller.
   *
   * @param {*} canvas Canvas used by this operation.
   */
  function attachWhitePicker(canvas) {
    canvas.addEventListener('pointerdown', event => {
      if (!whitePicking || !sourceData || busy || !event.isPrimary || event.button !== 0) return;
      const point = imagePoint(canvas, event);
      if (!point) return;
      event.preventDefault();
      pickStart = {point, pointerId: event.pointerId};
      canvas.setPointerCapture?.(event.pointerId);
      markSelection(canvas, point, point);
    });
    canvas.addEventListener('pointermove', event => {
      if (!pickStart || pickStart.pointerId !== event.pointerId) return;
      markSelection(canvas, pickStart.point, imagePoint(canvas, event, true));
    });
    canvas.addEventListener('pointercancel', event => {
      if (pickStart?.pointerId === event.pointerId) {
        pickStart = null;
        root()?.querySelector('[data-photo-editor-selection]')?.setAttribute('hidden', '');
      }
    });
    canvas.addEventListener('pointerup', event => {
      if (!pickStart || pickStart.pointerId !== event.pointerId || !root() || !sourceData) return;
      event.preventDefault();
      const start = pickStart.point;
      const end = imagePoint(canvas, event, true);
      pickStart = null;
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      let x0 = Math.min(start.x, end.x), x1 = Math.max(start.x, end.x);
      let y0 = Math.min(start.y, end.y), y1 = Math.max(start.y, end.y);
      // A single tap/click samples a small neighborhood, not a noisy lone
      // pixel.
      if (x1 - x0 < 3 && y1 - y0 < 3) {
        const radius = Math.max(3, Math.round(Math.min(sourceData.width, sourceData.height) * .012));
        x0 = start.x - radius; x1 = start.x + radius;
        y0 = start.y - radius; y1 = start.y + radius;
      }
      stopPicking();
      try {
        setValues(whiteBalanceFromArea(sourceData, {x: x0, y: y0, width: x1 - x0, height: y1 - y0}, values));
        if (root()) root().querySelector('[data-photo-editor-message]').textContent = t('photoEditor.pickedWhite');
      } catch (_) {
        syncSliders();
        if (root()) root().querySelector('[data-photo-editor-message]').textContent = t('photoEditor.pickWhiteError');
      }
    });
  }

  /**
   * Performs the stop brush lifecycle action.
   */
  function stopBrush() {
    brushMode = null;
    activeBrush = null;
    root()?.querySelector('[data-photo-editor-brush-cursor]')?.setAttribute('hidden', '');
  }

  /**
   * Performs the refresh mask preview lifecycle action.
   */
  function refreshMaskPreview() {
    if (!maskBaseData) return;
    sourceData = applyMaskStrokes(maskBaseData, maskStrokes);
    showingBefore = false;
    schedulePreview();
    syncSliders();
  }

  /**
   * Updates the DOM elements managed by toggle brush.
   *
   * @param {*} mode Selected mode controlling the operation.
   */
  function toggleBrush(mode) {
    if (!['erase', 'restore'].includes(mode) || busy || !maskBaseData || !root()) return;
    stopPicking();
    if (brushMode === mode) stopBrush();
    else {
      showingBefore = false; // Never paint on the uncut comparison view.
      schedulePreview();
      brushMode = mode;
      activeBrush = null;
    }
    syncSliders();
    root().querySelector('[data-photo-editor-message]').textContent = brushMode ? t(brushMode === 'erase' ? 'photoEditor.eraseHint' : 'photoEditor.restoreHint') : t('photoEditor.hint');
  }

  /**
   * Performs the undo brush lifecycle action.
   */
  function undoBrush() {
    if (busy || activeBrush || !maskStrokes.length) return;
    maskStrokes.pop();
    refreshMaskPreview();
  }

  /**
   * Derives the brush point result from the supplied values.
   *
   * @param {*} canvas Canvas used by the rendering operation.
   * @param {!Event} event Event that triggered this operation.
   * @return {!Object} Result computed from the supplied inputs.
   */
  function brushPoint(canvas, event) {
    const point = imagePoint(canvas, event);
    return point ? {
      x: point.x / sourceData.width, y: point.y / sourceData.height,
    } : null;
  }

  /**
   * Updates brush cursor in the current state.
   *
   * @param {*} canvas Canvas used by the rendering operation.
   * @param {!Event} event Event that triggered this operation.
   */
  function updateBrushCursor(canvas, event) {
    const cursor = root()?.querySelector('[data-photo-editor-brush-cursor]');
    if (!cursor || !brushMode || !maskBaseData) return;
    const point = imagePoint(canvas, event);
    if (!point) {cursor.hidden = true; return;}
    const frame = imageGeometry(canvas);
    const stageRect = canvas.closest('.photo-editor-image').getBoundingClientRect();
    const diameter = Math.min(sourceData.width, sourceData.height) * brushSize / 100 * frame.scale;
    cursor.style.width = `${diameter}px`;
    cursor.style.height = `${diameter}px`;
    cursor.style.left = `${frame.left - stageRect.left + point.x * frame.scale}px`;
    cursor.style.top = `${frame.top - stageRect.top + point.y * frame.scale}px`;
    cursor.hidden = false;
  }

  /**
   * Registers mask brush for controller.
   *
   * @param {*} canvas Canvas used by this operation.
   */
  function attachMaskBrush(canvas) {
    canvas.addEventListener('pointerdown', event => {
      if (!brushMode || busy || !maskBaseData || !sourceData || (event.pointerType === 'mouse' && event.button !== 0) ||
        !event.isPrimary) return;
      const point = brushPoint(canvas, event);
      if (!point) return;
      event.preventDefault();
      activeBrush = {
        pointerId: event.pointerId,
        stroke: {mode: brushMode, size: brushSize, points: [point]},
      };
      maskStrokes.push(activeBrush.stroke);
      canvas.setPointerCapture?.(event.pointerId);
      paintMaskSegment(
        sourceData.data,
        maskBaseData.data,
        sourceData.width,
        sourceData.height,
        point,
        point,
        brushSize,
        brushMode
      );
      showingBefore = false;
      syncSliders();
      schedulePreview();
      updateBrushCursor(canvas, event);
    });
    canvas.addEventListener('pointermove', event => {
      if (!brushMode) return;
      updateBrushCursor(canvas, event);
      if (!activeBrush || activeBrush.pointerId !== event.pointerId || busy) return;
      const current = brushPoint(canvas, event);
      if (!current) return;
      const stroke = activeBrush.stroke;
      const previous = stroke.points[stroke.points.length - 1];
      // Avoid very dense pointer samples on high refresh-rate mice.
      if (Math.hypot(current.x - previous.x, current.y - previous.y) < .0005) return;
      stroke.points.push(current);
      paintMaskSegment(
        sourceData.data,
        maskBaseData.data,
        sourceData.width,
        sourceData.height,
        previous,
        current,
        stroke.size,
        stroke.mode
      );
      schedulePreview();
    });
    /**
     * Derives the release result from the supplied values.
     *
     * @param {!Event} event Event that triggered this operation.
     */
    const release = event => {
      if (!activeBrush || activeBrush.pointerId !== event.pointerId) return;
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (event.type === 'pointercancel') {
        maskStrokes.pop();
        refreshMaskPreview();
      }
      activeBrush = null;
      syncSliders();
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('pointerleave', () => {
      root()?.querySelector('[data-photo-editor-brush-cursor]')?.setAttribute('hidden', '');
    });
  }

  /**
   * Locates the DOM elements used by paint preview.
   */
  function paintPreview() {
    const host = root();
    if (!host || !sourceData) return;
    const canvas = host.querySelector('[data-photo-editor-preview]');
    if (!canvas) return;
    // The comparison must switch canvas pixels before aria-pressed / UI state
    // advertises completion; otherwise browser assertions and users briefly
    // see the previous (potentially transparent) frame.
    const adjusted = showingBefore
      ? (previewCutout ? originalPreviewData || sourceData : sourceData)
      : adjustPhotoPixels(sourceData, values);
    if (canvas.width !== adjusted.width || canvas.height !== adjusted.height) {
      canvas.width = adjusted.width;
      canvas.height = adjusted.height;
    }
    canvas.getContext('2d', {willReadFrequently: true}).putImageData(new ImageData(adjusted.data, adjusted.width, adjusted.height),
      0,
      0
    );
  }

  /**
   * Updates the schedule preview state for its caller.
   */
  function schedulePreview() {
    const thisGeneration = generation;
    if (renderId) cancelAnimationFrame(renderId);
    renderId = requestAnimationFrame(() => {
      renderId = 0;
      if (thisGeneration === generation) paintPreview();
    });
  }

  /**
   * Renders preview now in the current view.
   */
  function showPreviewNow() {
    if (renderId) cancelAnimationFrame(renderId);
    renderId = 0;
    paintPreview();
  }

  /**
   * Retrieves source image from the available state.
   *
   * @param {*} path Path to the target resource.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function loadSourceImage(path) {
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

  /**
   * Controls the controller state.
   *
   * @param {*} button Button used by this operation.
   */
  async function open(button) {
    const bottleId = button?.dataset.id;
    const photoId = button?.dataset.photoId;
    const photo = findPhoto(bottleId, photoId);
    if (!photo) return;
    const sourcePath = basePhotoPath(photo);
    selection = {bottleId, photoId, sourcePath};
    previewCutout = Boolean(photo.cutout?.selected);
    const {original: originalSettings, cutout: cutoutSettings} = editorPhotoSourceSettings(photo);
    sourceValues = {
      original: validatePhotoAdjustments(originalSettings || EMPTY_PHOTO_ADJUSTMENTS),
      cutout: validatePhotoAdjustments(cutoutSettings || EMPTY_PHOTO_ADJUSTMENTS),
    };
    savedSourceValues = {
      original: {...sourceValues.original}, cutout: {...sourceValues.cutout},
    };
    values = {...sourceValues[previewCutout ? 'cutout' : 'original']};
    cutoutMaskStrokes = [];
    sourceData = null;
    originalPreviewData = null;
    sourceImages = {original: null, cutout: null};
    sourcePixels = {original: null, cutout: null};
    image = null;
    pendingCutout = null;
    maskBaseData = null; maskStrokes = []; brushMode = null; brushSize = DEFAULT_MASK_BRUSH_SIZE; activeBrush = null;
    busy = false;
    whitePicking = false;
    pickStart = null;
    showingBefore = false;
    activeTab = 'adjustments';
    resetViewport(false);
    generation++;
    const currentGeneration = generation;
    if (renderId) cancelAnimationFrame(renderId);
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
        brushSize = Number(event.target.value);
        syncSliders();
        return;
      }
      const input = event.target.closest('[data-photo-slider]');
      if (!input || busy) return;
      values[input.dataset.photoSlider] = Number(input.value);
      sourceValues[previewCutout ? 'cutout' : 'original'] = {...values};
      showingBefore = false;
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
      if (event.key === 'Escape' && (whitePicking || brushMode)) {
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
      if (currentGeneration !== generation || !root()) return;
      sourceImages = {original: originalImage, cutout: cutoutImage};
      sourcePixels = {
        original: imageDataFromCanvas(canvasFromImage(originalImage, MAX_PREVIEW_SIDE)),
        cutout: cutoutImage ? imageDataFromCanvas(canvasFromImage(cutoutImage, MAX_PREVIEW_SIDE)) : null,
      };
      originalPreviewData = sourcePixels.original;
      const sourceKey = previewCutout ? 'cutout' : 'original';
      image = sourceImages[sourceKey];
      sourceData = clonePixels(sourcePixels[sourceKey]);
      maskBaseData = previewCutout ? clonePixels(sourcePixels.cutout) : null;
      const preview = root().querySelector('[data-photo-editor-preview]');
      preview.width = sourceData.width;
      preview.height = sourceData.height;
      showPreviewNow();
      root().querySelector('[data-photo-editor-message]').textContent = t('photoEditor.hint');
      syncSliders();
      resetViewport();

    } catch (error) {
      if (currentGeneration !== generation || !root()) return;
      root().querySelector('[data-photo-editor-message]').textContent = t('photoEditor.error');
      toast(error.message, true);
    }
  }

  /**
   * Updates values in the current state.
   *
   * @param {*} next Next candidate state or entry.
   */
  function setValues(next) {
    if (!root() || busy || !sourceData) return;
    values = validatePhotoAdjustments(next);
    sourceValues[previewCutout ? 'cutout' : 'original'] = {...values};
    stopPicking();
    showingBefore = false;
    syncSliders();
    schedulePreview();
  }

  /**
   * Updates the reset state for its caller.
   */
  function reset() {setValues(EMPTY_PHOTO_ADJUSTMENTS);}

  /**
   * Removes or resets group.
   *
   * @param {*} groupKey Value used by this operation.
   */
  function resetGroup(groupKey) {
    if (!PHOTO_ADJUSTMENT_GROUPS.some(group => group.key === groupKey)) return;
    setValues(resetPhotoAdjustmentGroup(values, groupKey));
  }

  /**
   * Updates the DOM elements managed by toggle white picker.
   */
  function toggleWhitePicker() {
    if (!root() || busy || !sourceData) return;
    if (whitePicking) stopPicking();
    else {
      stopBrush();
      showingBefore = false; // Sample the image that will actually be edited.
      schedulePreview();
      whitePicking = true;
    }
    syncSliders();
    root().querySelector('[data-photo-editor-message]').textContent =
      whitePicking ? t('photoEditor.pickWhiteHint') : t('photoEditor.hint');
  }

  /**
   * Updates the auto state for its caller.
   */
  function auto() {if (sourceData) setValues(autoPhotoAdjustments(sourceData));}

  /**
   * Prepares the controller state.
   */
  async function before() {
    if (!root() || !sourceData || busy) return;
    if (showingBefore) {
      showingBefore = false;
      showPreviewNow();
      syncSliders();
      return;
    }
    stopPicking();
    stopBrush();
    if (previewCutout && !originalPreviewData) {
      const photo = selection && findPhoto(selection.bottleId, selection.photoId);
      if (!photo) return;
      const thisGeneration = generation;
      busy = true;
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
        if (generation !== thisGeneration || !root()) return;
        originalPreviewData = imageDataFromCanvas(canvasFromImage(original, MAX_PREVIEW_SIDE));
      } catch (error) {
        if (generation === thisGeneration && root()) toast(error.message, true);
        return;
      } finally {
        if (generation === thisGeneration) {
          busy = false;
          if (root()) syncSliders();
        }
      }
    }
    if (!root()) return;
    showingBefore = true;
    showPreviewNow();
    syncSliders();
  }

  // Generate a new transparent cutout from the retained original. The
  // segmentation
  // model sees the current corrections; the transparent output does NOT bake
  // them.
  // This prevents double correction when adjusting a cutout later.
  /**
   * Updates the DOM elements managed by cutout.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function cutout() {
    if (busy || !selection || !sourceData || !root()) return;
    const photo = findPhoto(selection.bottleId, selection.photoId);
    if (!photo) return;
    busy = true;
    stopPicking();
    syncSliders();
    const thisGeneration = generation;
    const message = root().querySelector('[data-photo-editor-message]');
    try {
      const originalUrl = imageUrl(photo.path);
      let segmentationUrl;
      if (Object.values(values).some(value => value !== 0)) {
        const original = new Image();
        original.decoding = 'async';
        original.crossOrigin = 'anonymous';
        original.src = originalUrl;
        await original.decode();
        const sourceCanvas = canvasFromImage(original, MAX_PREVIEW_SIDE);
        const corrected = adjustPhotoPixels(imageDataFromCanvas(sourceCanvas), values);
        sourceCanvas.getContext('2d').putImageData(new ImageData(corrected.data, corrected.width, corrected.height),
          0,
          0
        );
        segmentationUrl = sourceCanvas.toDataURL('image/png');
      }
      const cutoutData = await cutoutImage(originalUrl, phase => {
        if (generation === thisGeneration && root()) message.textContent = t(`cutout.${phase}`);
      }, {segmentationUrl});
      if (generation !== thisGeneration || !root()) return;
      const cutoutImageElement = new Image();
      cutoutImageElement.src = cutoutData;
      await cutoutImageElement.decode();
      if (generation !== thisGeneration || !root()) return;
      pendingCutout = cutoutData;
      // Retain the uncropped original for immediate before/after comparison.
      if (!previewCutout) originalPreviewData = sourceData;
      previewCutout = true;
      sourceValues.cutout = {...values};
      savedSourceValues.cutout = {...EMPTY_PHOTO_ADJUSTMENTS};
      cutoutMaskStrokes = [];
      maskStrokes = []; stopBrush();
      image = cutoutImageElement;
      const canvas = canvasFromImage(image, MAX_PREVIEW_SIDE);
      sourceData = imageDataFromCanvas(canvas);
      maskBaseData = imageDataFromCanvas(canvas);
      const preview = root().querySelector('[data-photo-editor-preview]');
      preview.width = canvas.width;
      preview.height = canvas.height;
      showingBefore = false;
      resetViewport();
      showPreviewNow();
      message.textContent = t('photoEditor.cutoutReady');
    } catch (error) {
      if (generation === thisGeneration && root()) {
        message.textContent = t('cutout.failed');
        toast(`${t('cutout.failed')}: ${error.message}`, true);
      }
    } finally {
      if (generation === thisGeneration) {
        busy = false;
        if (root()) syncSliders();
      }
    }
  }

  /**
   * Controls cutout for controller.
   */
  function toggleCutout() {
    const photo = selection && findPhoto(selection.bottleId, selection.photoId);
    if (!photo?.cutout || busy || pendingCutout || !root()) return;
    const next = !previewCutout;
    const key = next ? 'cutout' : 'original';
    if (!sourceImages[key] || !sourcePixels[key]) return;
    stopPicking();
    stopBrush();
    if (previewCutout) cutoutMaskStrokes = maskStrokes.map(stroke => ({...stroke}));
    sourceValues[previewCutout ? 'cutout' : 'original'] = {...values};
    image = sourceImages[key];
    maskBaseData = next ? clonePixels(sourcePixels.cutout) : null;
    maskStrokes = next ? cutoutMaskStrokes.map(stroke => ({...stroke})) : [];
    sourceData = next && maskStrokes.length ? applyMaskStrokes(maskBaseData, maskStrokes) : clonePixels(sourcePixels[key]);
    previewCutout = next;
    values = {...sourceValues[key]};
    showingBefore = false;
    resetViewport();
    showPreviewNow();
    root().querySelector('[data-photo-editor-message]').textContent = t('photoEditor.hint');
    syncSliders();
  }

  /**
   * Clears cutout for controller.
   */
  async function removeCutout() {
    const photo = selection && findPhoto(selection.bottleId, selection.photoId);
    if (!photo || busy || !root()) return;
    if (pendingCutout) {
      busy = true;
      syncSliders();
      const thisGeneration = generation;
      try {
        const original = new Image();
        original.crossOrigin = 'anonymous';
        original.decoding = 'async';
        original.src = imageUrl(photo.path);
        await original.decode();
        if (thisGeneration !== generation || !root()) return;
        image = original;
        const canvas = canvasFromImage(original, MAX_PREVIEW_SIDE);
        sourceData = imageDataFromCanvas(canvas);
        const preview = root().querySelector('[data-photo-editor-preview]');
        preview.width = canvas.width;
        preview.height = canvas.height;
        pendingCutout = null;
        previewCutout = false;
        values = {...sourceValues.original};
        maskBaseData = null; maskStrokes = []; cutoutMaskStrokes = []; stopBrush();
        showingBefore = false;
        root().querySelector('[data-photo-editor-message]').textContent = t('cutout.removed');
        resetViewport();
        schedulePreview();
      } catch (error) {
        toast(error.message, true);
      } finally {
        busy = false;
        if (root()) syncSliders();
      }
      return;
    }
    if (!photo.cutout) return;
    const result = await action(() => request(
      `/api/bottles/${encodeURIComponent(selection.bottleId)}/photos/${encodeURIComponent(selection.photoId)}/cutout`,
      {method: 'DELETE'}
    ));
    if (result.ok) {generation++; closeModal(true); toast(t('cutout.removed'));}
  }

  /**
   * Updates the controller state.
   */
  async function save() {
    if (busy || !sourceData || !image || !selection || !root()) return;
    busy = true;
    const thisGeneration = generation;
    syncSliders();
    const host = root();
    const message = host.querySelector('[data-photo-editor-message]');
    message.textContent = t('photoEditor.saving');
    try {
      const storedSettings = validatePhotoAdjustments(values);
      const photo = findPhoto(selection.bottleId, selection.photoId);
      const sourceKey = previewCutout ? 'cutout' : 'original';
      const savedSettings = savedSourceValues[sourceKey];
      const settingsChanged = Object.keys(storedSettings).some(key => storedSettings[key] !== savedSettings[key]);
      const selectedChanged = Boolean(photo?.cutout) && previewCutout !== photo.cutout.selected;
      const cutoutEndpoint = endpoint().replace(/\/adjustments$/, '/cutout');
      /**
       * Selects for save matching the input.
       * @return {!Promise<*>} Promise for the asynchronous operation.
       */
      const selectForSave = () => request(cutoutEndpoint, {
        method: 'PATCH', body: JSON.stringify({selected: previewCutout}),
      });

      /**
       * Performs the commit lifecycle action.
       *
       * @param {function(...*): *} callback Callback invoked by the operation.
       * @return {*} Result computed from the supplied inputs.
       */
      const commit = callback => action(async () => {
        // The API selects the image separately from its adjustments;
        // synchronize
        // the source before saving an edited derivative of that source.
        if (selectedChanged) await selectForSave();
        return callback ? await callback() : {ok: true};
      });

      /**
       * Builds the localized finish save text for the current language.
       *
       * @param {*} result Result from the preceding operation.
       */
      const finishSave = result => {
        if (generation !== thisGeneration || !root()) return;
        if (!result.ok) {
          message.textContent = result.error.message;
          return;
        }
        generation++;
        closeModal(true);
        toast(t('photoEditor.saved'));
      };
      const savingCutout = Boolean(pendingCutout || (previewCutout && maskStrokes.length));
      // Merely showing a different variant is a preview-only operation.
      // Save commits that selection; unchanged settings must never trigger a
      // regeneration or deletion of an existing edited derivative.
      if (!savingCutout && !settingsChanged) {
        const result = selectedChanged ? await commit() : {ok: true};
        finishSave(result);
        return;
      }
      if (!savingCutout && Object.values(storedSettings).every(value => value === 0)) {
        const result = await commit(() => request(endpoint(), {method: 'DELETE'}));
        finishSave(result);
        return;
      }
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
      if (generation !== thisGeneration || !root()) return;
      const payload = savingCutout
        ? {
          image: cutoutDataUrl,
          ...(hasEdits ? {adjustment: {image: imageDataUrl, settings: storedSettings}} : {}),
        }
        : {image: imageDataUrl, settings: storedSettings};
      const target = savingCutout ? endpoint().replace(/\/adjustments$/, '/cutout') : endpoint();
      const result = await commit(() => request(target, {
        method: 'PUT', body: JSON.stringify(payload),
      }));
      finishSave(result);
    } catch (error) {
      if (generation === thisGeneration && root()) {
        toast(error.message, true);
        message.textContent = error.message;
      }
    } finally {
      if (generation === thisGeneration) {
        busy = false;
        if (root()) syncSliders();
      }
    }
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
