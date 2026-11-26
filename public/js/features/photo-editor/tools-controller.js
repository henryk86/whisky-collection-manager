import {t} from '../../i18n/index.js';
import {whiteBalanceFromArea} from './adjustments.js';
import {paintMaskSegment, applyMaskStrokes} from './mask-brush.js';

/**
 * Handles white-balance sampling and mask brush pointer gestures for one editor.
 * @param {!Object} options Session, preview root and update callbacks.
 * @return {!Object} Pointer-tool operations and event attachment functions.
 */
export function createPhotoTools({session, root, setValues, syncSliders, schedulePreview}) {
  /**
   * Leaves white-balance picking mode and hides the selection overlay.
   */
  function stopPicking() {
    session.whitePicking = false;
    session.pickStart = null;
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
   * Calculates the fitted image rectangle within the preview canvas.
   *
   * @param {*} canvas Canvas used by the rendering operation.
   * @return {!Object} Image offset, displayed dimensions and source-to-screen scale.
   */
  function imageGeometry(canvas) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / session.sourceData.width, rect.height / session.sourceData.height);
    return {
      left: rect.left + (rect.width - session.sourceData.width * scale) / 2,
      top: rect.top + (rect.height - session.sourceData.height * scale) / 2,
      width: session.sourceData.width * scale, height: session.sourceData.height * scale, scale,
    };
  }

  /**
   * Converts a pointer position into source-image coordinates.
   *
   * @param {*} canvas Canvas used by the rendering operation.
   * @param {{clientX: number, clientY: number}} event Pointer position in viewport pixels.
   * @param {boolean=} clampToImage Clamp pointer coordinates to the image bounds instead of rejecting outside points.
   * @return {!Object} Source-pixel coordinates, or null for an outside point when clamping is disabled.
   */
  function imagePoint(canvas, event, clampToImage = false) {
    const frame = imageGeometry(canvas);
    const x = (event.clientX - frame.left) / frame.scale;
    const y = (event.clientY - frame.top) / frame.scale;
    if (!clampToImage && (x < 0 || y < 0 || x > session.sourceData.width || y > session.sourceData.height)) return null;
    return {
      x: Math.max(0, Math.min(session.sourceData.width, x)),
      y: Math.max(0, Math.min(session.sourceData.height, y)),
    };
  }

  /**
   * Positions the white-balance selection overlay over the sampled source rectangle.
   *
   * @param {*} canvas Canvas used by the rendering operation.
   * @param {*} start Starting corner of the selected area in source-image pixels.
   * @param {*} end Ending corner of the selected area in source-image pixels.
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
   * @param {*} canvas Canvas on which the white-balance sampling gestures are registered.
   */
  function attachWhitePicker(canvas) {
    canvas.addEventListener('pointerdown', event => {
      if (!session.whitePicking || !session.sourceData || session.busy || !event.isPrimary || event.button !== 0) return;
      const point = imagePoint(canvas, event);
      if (!point) return;
      event.preventDefault();
      session.pickStart = {point, pointerId: event.pointerId};
      canvas.setPointerCapture?.(event.pointerId);
      markSelection(canvas, point, point);
    });
    canvas.addEventListener('pointermove', event => {
      if (!session.pickStart || session.pickStart.pointerId !== event.pointerId) return;
      markSelection(canvas, session.pickStart.point, imagePoint(canvas, event, true));
    });
    canvas.addEventListener('pointercancel', event => {
      if (session.pickStart?.pointerId === event.pointerId) {
        session.pickStart = null;
        root()?.querySelector('[data-photo-editor-selection]')?.setAttribute('hidden', '');
      }
    });
    canvas.addEventListener('pointerup', event => {
      if (!session.pickStart || session.pickStart.pointerId !== event.pointerId || !root() || !session.sourceData) return;
      event.preventDefault();
      const start = session.pickStart.point;
      const end = imagePoint(canvas, event, true);
      session.pickStart = null;
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      let x0 = Math.min(start.x, end.x), x1 = Math.max(start.x, end.x);
      let y0 = Math.min(start.y, end.y), y1 = Math.max(start.y, end.y);
      // A single tap/click samples a small neighborhood, not a noisy lone
      // pixel.
      if (x1 - x0 < 3 && y1 - y0 < 3) {
        const radius = Math.max(3, Math.round(Math.min(session.sourceData.width, session.sourceData.height) * .012));
        x0 = start.x - radius; x1 = start.x + radius;
        y0 = start.y - radius; y1 = start.y + radius;
      }
      stopPicking();
      try {
        setValues(whiteBalanceFromArea(session.sourceData, {x: x0, y: y0, width: x1 - x0, height: y1 - y0}, session.values));
        if (root()) root().querySelector('[data-photo-editor-message]').textContent = t('photoEditor.pickedWhite');
      } catch (_) {
        syncSliders();
        if (root()) root().querySelector('[data-photo-editor-message]').textContent = t('photoEditor.pickWhiteError');
      }
    });
  }

  /**
   * Exits brush mode and hides the brush cursor.
   */
  function stopBrush() {
    session.brushMode = null;
    session.activeBrush = null;
    root()?.querySelector('[data-photo-editor-brush-cursor]')?.setAttribute('hidden', '');
  }

  /**
   * Reapplies mask strokes to the base image and schedules an updated preview.
   */
  function refreshMaskPreview() {
    if (!session.maskBaseData) return;
    session.sourceData = applyMaskStrokes(session.maskBaseData, session.maskStrokes);
    session.showingBefore = false;
    schedulePreview();
    syncSliders();
  }

  /**
   * Updates the DOM elements managed by toggle brush.
   *
   * @param {*} mode Selected mode controlling the operation.
   */
  function toggleBrush(mode) {
    if (!['erase', 'restore'].includes(mode) || session.busy || !session.maskBaseData || !root()) return;
    stopPicking();
    if (session.brushMode === mode) stopBrush();
    else {
      session.showingBefore = false; // Never paint on the uncut comparison view.
      schedulePreview();
      session.brushMode = mode;
      session.activeBrush = null;
    }
    syncSliders();
    root().querySelector('[data-photo-editor-message]').textContent = session.brushMode ? t(session.brushMode === 'erase' ? 'photoEditor.eraseHint' : 'photoEditor.restoreHint') : t('photoEditor.hint');
  }

  /**
   * Removes the most recent completed mask stroke when no brush gesture is active.
   */
  function undoBrush() {
    if (session.busy || session.activeBrush || !session.maskStrokes.length) return;
    session.maskStrokes.pop();
    refreshMaskPreview();
  }

  /**
   * Converts a pointer position into normalized image coordinates for mask strokes.
   *
   * @param {*} canvas Canvas used by the rendering operation.
   * @param {!PointerEvent} event Pointer event supplying the current brush position.
   * @return {!Object} Normalized image point used by a mask stroke.
   */
  function brushPoint(canvas, event) {
    const point = imagePoint(canvas, event);
    return point ? {
      x: point.x / session.sourceData.width, y: point.y / session.sourceData.height,
    } : null;
  }

  /**
   * Positions and sizes the brush cursor for the current pointer and image scale.
   *
   * @param {*} canvas Canvas used by the rendering operation.
   * @param {!PointerEvent} event Pointer event supplying the current brush position.
   */
  function updateBrushCursor(canvas, event) {
    const cursor = root()?.querySelector('[data-photo-editor-brush-cursor]');
    if (!cursor || !session.brushMode || !session.maskBaseData) return;
    const point = imagePoint(canvas, event);
    if (!point) {cursor.hidden = true; return;}
    const frame = imageGeometry(canvas);
    const stageRect = canvas.closest('.photo-editor-image').getBoundingClientRect();
    const diameter = Math.min(session.sourceData.width, session.sourceData.height) * session.brushSize / 100 * frame.scale;
    cursor.style.width = `${diameter}px`;
    cursor.style.height = `${diameter}px`;
    cursor.style.left = `${frame.left - stageRect.left + point.x * frame.scale}px`;
    cursor.style.top = `${frame.top - stageRect.top + point.y * frame.scale}px`;
    cursor.hidden = false;
  }

  /**
   * Registers mask brush for controller.
   *
   * @param {*} canvas Canvas on which mask painting gestures are registered.
   */
  function attachMaskBrush(canvas) {
    canvas.addEventListener('pointerdown', event => {
      if (!session.brushMode || session.busy || !session.maskBaseData || !session.sourceData || (event.pointerType === 'mouse' && event.button !== 0) ||
        !event.isPrimary) return;
      const point = brushPoint(canvas, event);
      if (!point) return;
      event.preventDefault();
      session.activeBrush = {
        pointerId: event.pointerId,
        stroke: {mode: session.brushMode, size: session.brushSize, points: [point]},
      };
      session.maskStrokes.push(session.activeBrush.stroke);
      canvas.setPointerCapture?.(event.pointerId);
      paintMaskSegment(
        session.sourceData.data,
        session.maskBaseData.data,
        session.sourceData.width,
        session.sourceData.height,
        point,
        point,
        session.brushSize,
        session.brushMode
      );
      session.showingBefore = false;
      syncSliders();
      schedulePreview();
      updateBrushCursor(canvas, event);
    });
    canvas.addEventListener('pointermove', event => {
      if (!session.brushMode) return;
      updateBrushCursor(canvas, event);
      if (!session.activeBrush || session.activeBrush.pointerId !== event.pointerId || session.busy) return;
      const current = brushPoint(canvas, event);
      if (!current) return;
      const stroke = session.activeBrush.stroke;
      const previous = stroke.points[stroke.points.length - 1];
      // Avoid very dense pointer samples on high refresh-rate mice.
      if (Math.hypot(current.x - previous.x, current.y - previous.y) < .0005) return;
      stroke.points.push(current);
      paintMaskSegment(
        session.sourceData.data,
        session.maskBaseData.data,
        session.sourceData.width,
        session.sourceData.height,
        previous,
        current,
        stroke.size,
        stroke.mode
      );
      schedulePreview();
    });
    /**
     * Finishes or cancels the active mask stroke and releases pointer capture.
     *
     * @param {!PointerEvent} event Event that triggered this operation.
     */
    const release = event => {
      if (!session.activeBrush || session.activeBrush.pointerId !== event.pointerId) return;
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (event.type === 'pointercancel') {
        session.maskStrokes.pop();
        refreshMaskPreview();
      }
      session.activeBrush = null;
      syncSliders();
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('pointerleave', () => {
      root()?.querySelector('[data-photo-editor-brush-cursor]')?.setAttribute('hidden', '');
    });
  }

  /**
   * Updates the DOM elements managed by toggle white picker.
   */
  function toggleWhitePicker() {
    if (!root() || session.busy || !session.sourceData) return;
    if (session.whitePicking) stopPicking();
    else {
      stopBrush();
      session.showingBefore = false; // Sample the image that will actually be edited.
      schedulePreview();
      session.whitePicking = true;
    }
    syncSliders();
    root().querySelector('[data-photo-editor-message]').textContent =
      session.whitePicking ? t('photoEditor.pickWhiteHint') : t('photoEditor.hint');
  }

  return {stopPicking, stopBrush, toggleWhitePicker, toggleBrush, undoBrush, attachWhitePicker, attachMaskBrush};
}
