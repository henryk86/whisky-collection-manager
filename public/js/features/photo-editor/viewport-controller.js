import {
  MIN_PREVIEW_ZOOM, MAX_PREVIEW_ZOOM, clampPreviewZoom, zoomAroundPoint,
  constrainPreviewPan
} from './preview-zoom.js';

/**
 * Owns preview magnification and pointer gestures independently of photo editing.
 * @param {!Object} options DOM accessor and interaction permissions.
 * @return {!Object} Preview interaction controller.
 */
export function createPhotoViewport({root, canZoom, canPan, picking}) {
  let viewport = {zoom: 1, x: 0, y: 0};
  const panPointers = new Map();
  let panStart = null;
  let pinchStart = null;
  /**
   * Locates the DOM elements used by viewport size.
   * @return {!Object} Structured result assembled from the input data.
   */
  function viewportSize() {
    const canvas = root()?.querySelector('[data-photo-editor-preview]');
    return {width: canvas?.clientWidth || 1, height: canvas?.clientHeight || 1};
  }

  /**
   * Updates viewport for controller.
   */
  function updateViewport() {
    const host = root();
    if (!host) return;
    const canvas = host.querySelector('[data-photo-editor-preview]');
    if (!canvas) return;
    viewport = constrainPreviewPan(viewport, viewportSize());
    canvas.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`;
    host.querySelector('[data-photo-editor-zoom-level]').textContent = `${Math.round(viewport.zoom * 100)} %`;
    host.querySelector('[data-act="photo-editor-zoom-out"]').disabled = viewport.zoom <= MIN_PREVIEW_ZOOM;
    host.querySelector('[data-act="photo-editor-zoom-in"]').disabled = viewport.zoom >= MAX_PREVIEW_ZOOM;
    host.querySelector('[data-act="photo-editor-zoom-reset"]').disabled = viewport.zoom === MIN_PREVIEW_ZOOM;
    host.querySelector('.photo-editor-image').classList.toggle('is-zoomed', viewport.zoom > MIN_PREVIEW_ZOOM);
  }

  /**
   * Derives the zoom result from the supplied values.
   *
   * @param {*} direction Direction used for traversal or movement.
   * @param {*=} pointer Value used by this operation.
   */
  function zoom(direction, pointer = null) {
    if (!root() || !canZoom()) return;
    const size = viewportSize();
    viewport = zoomAroundPoint(
      viewport,
      direction === 0 ? 1 : clampPreviewZoom(viewport.zoom * direction),
      pointer || {x: size.width / 2, y: size.height / 2},
      size
    );
    updateViewport();
  }

  /**
   * Registers viewport for controller.
   *
   * @param {*} canvas Canvas used by this operation.
   */
  function attachViewport(canvas) {
    const stage = canvas.closest('.photo-editor-image');
    stage.addEventListener('wheel', event => {
      if (picking() || !canZoom()) return;
      event.preventDefault();
      // Canvas coordinates must be relative to its untransformed layout box.
      const stageRect = stage.getBoundingClientRect();
      const point = {
        x: event.clientX - stageRect.left - stage.clientLeft - parseFloat(getComputedStyle(stage).paddingLeft || 0),
        y: event.clientY - stageRect.top - stage.clientTop - parseFloat(getComputedStyle(stage).paddingTop || 0),
      };
      zoom(event.deltaY < 0 ? 1.15 : 1 / 1.15, point);
    }, {passive: false});
    canvas.addEventListener('pointerdown', event => {
      if (!canPan() || viewport.zoom === 1 || !event.isPrimary && event.pointerType !== 'touch') return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      panPointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
      canvas.setPointerCapture?.(event.pointerId);
      if (panPointers.size === 1) {
        panStart = {
          x: event.clientX, y: event.clientY, viewport: {...viewport},
        };
        pinchStart = null;
      } else if (panPointers.size === 2) {
        const [a, b] = [...panPointers.values()];
        pinchStart = {
          distance: Math.hypot(b.x - a.x, b.y - a.y), zoom: viewport.zoom,
        };
        panStart = null;
      }
    });
    canvas.addEventListener('pointermove', event => {
      if (!panPointers.has(event.pointerId) || picking()) return;
      panPointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
      if (pinchStart && panPointers.size === 2) {
        const [a, b] = [...panPointers.values()];
        const stageRect = stage.getBoundingClientRect();
        const point = {
          x: (a.x + b.x) / 2 - stageRect.left - stage.clientLeft - parseFloat(getComputedStyle(stage).paddingLeft || 0),
          y: (a.y + b.y) / 2 - stageRect.top - stage.clientTop - parseFloat(getComputedStyle(stage).paddingTop || 0),
        };
        // Finger distance is proportional to preview magnification.
        viewport = zoomAroundPoint(
          viewport,
          viewport.zoom * (Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, pinchStart.lastDistance || pinchStart.distance)),
          point,
          viewportSize()
        );
        pinchStart.lastDistance = Math.hypot(b.x - a.x, b.y - a.y);
        updateViewport();
      } else if (panStart && panPointers.size === 1) {
        viewport = constrainPreviewPan({
          zoom: panStart.viewport.zoom,
          x: panStart.viewport.x + event.clientX - panStart.x,
          y: panStart.viewport.y + event.clientY - panStart.y,
        }, viewportSize());
        updateViewport();
      }
    });
    /**
     * Derives the release result from the supplied values.
     *
     * @param {!Event} event Event that triggered this operation.
     */
    const release = event => {
      if (!panPointers.delete(event.pointerId)) return;
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      pinchStart = null;
      panStart = null;
      if (panPointers.size === 1) {
        const [position] = panPointers.values();
        panStart = {x: position.x, y: position.y, viewport: {...viewport}};
      }
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
  }

  /**
   * Resets preview coordinates and active gestures.
   * @param {boolean=} update Whether to update the currently mounted preview.
   */
  function resetViewport(update = true) {
    viewport = {zoom: 1, x: 0, y: 0};
    panPointers.clear(); panStart = null; pinchStart = null;
    if (update && root()) updateViewport();
  }

  return {zoom, attachViewport, resetViewport, updateViewport};
}
