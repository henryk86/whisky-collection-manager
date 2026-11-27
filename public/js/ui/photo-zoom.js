/** Display-only image magnification: never changes the stored picture. */
export const PHOTO_ZOOM_MIN = 1;
export const PHOTO_ZOOM_MAX = 6;
/**
 * Limits photo-viewer zoom to its configured bounds.
 *
 * @param {*} zoom Map scale used for projection.
 * @return {number} Zoom factor clamped to the viewer's configured range.
 */
export const clampPhotoZoom = zoom => Math.max(PHOTO_ZOOM_MIN, Math.min(PHOTO_ZOOM_MAX, zoom));

/**
 * Keeps the zoomed photo within its allowable pan area.
 *
 * @param {*} view Current zoom scale and pan offsets in CSS pixels.
 * @param {*} stage Viewport width and height in CSS pixels.
 * @param {*} image Unscaled image width and height in CSS pixels.
 * @return {*} Zoom and pan state with both offsets constrained to the visible image bounds.
 */
export function constrainPhotoPan(view, stage, image) {
  const maxX = Math.max(0, (image.width * view.zoom - stage.width) / 2);
  const maxY = Math.max(0, (image.height * view.zoom - stage.height) / 2);
  return {
    ...view,
    x: Math.max(-maxX, Math.min(maxX, view.x)),
    y: Math.max(-maxY, Math.min(maxY, view.y)),
  };
}

/**
 * Changes photo zoom around a fixed interaction point.
 *
 * @param {*} view Current zoom scale and pan offsets in CSS pixels.
 * @param {*} requestedZoom New zoom level requested by the user.
 * @param {*} point Zoom anchor relative to the viewport in CSS pixels.
 * @param {*} stage Viewport width and height in CSS pixels.
 * @param {*} image Unscaled image width and height in CSS pixels.
 * @return {*} Constrained zoom and pan state retaining the specified interaction point where possible.
 */
export function zoomPhotoAt(view, requestedZoom, point, stage, image) {
  const zoom = clampPhotoZoom(requestedZoom);
  const ratio = zoom / view.zoom;
  return constrainPhotoPan({
    zoom,
    x: point.x - stage.width / 2 - (point.x - stage.width / 2 - view.x) * ratio,
    y: point.y - stage.height / 2 - (point.y - stage.height / 2 - view.y) * ratio,
  }, stage, image);
}

/**
 * Creates a zoom and pan controller for an image displayed in a viewport.
 *
 * @return {!Object} Image mounting, navigation and zoom operations.
 */
export function createPhotoZoom() {
  let stage = null;
  let image = null;
  let view = {zoom: 1, x: 0, y: 0};
  const pointers = new Map();
  let lastPinchDistance = null;

  /**
   * Reads the viewport and unscaled image layout dimensions for pan constraints.
   * @return {!Object} Viewport and unscaled image dimensions in CSS pixels.
   */
  function dimensions() {
    return {
      stage: {width: stage?.clientWidth || 1, height: stage?.clientHeight || 1},
      image: {width: image?.offsetWidth || 1, height: image?.offsetHeight || 1},
    };
  }

  /**
   * Updates the DOM elements managed by render.
   */
  function render() {
    if (!stage?.isConnected || !image) return;
    const {stage: area, image: picture} = dimensions();
    view = constrainPhotoPan(view, area, picture);
    image.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`;
    stage.classList.toggle('is-zoomed', view.zoom > PHOTO_ZOOM_MIN);
    const controls = stage.closest('.photo-lightbox')?.querySelector('.photo-lightbox-zoom');
    if (!controls) return;
    const value = controls.querySelector('[data-photo-zoom-level]');
    if (value) value.textContent = `${Math.round(view.zoom * 100)} %`;
    const minus = controls.querySelector('[data-act="photo-zoom-out"]');
    const plus = controls.querySelector('[data-act="photo-zoom-in"]');
    const reset = controls.querySelector('[data-act="photo-zoom-reset"]');
    if (minus) minus.disabled = view.zoom <= PHOTO_ZOOM_MIN;
    if (plus) plus.disabled = view.zoom >= PHOTO_ZOOM_MAX;
    if (reset) reset.disabled = view.zoom <= PHOTO_ZOOM_MIN;
  }

  /**
   * Converts pointer client coordinates to coordinates relative to the photo viewport.
   *
   * @param {{clientX: number, clientY: number}} event Native or synthesized pointer coordinates.
   * @return {!Object} Pointer coordinates relative to the image viewport.
   */
  function pointOf(event) {
    const rect = stage.getBoundingClientRect();
    return {x: event.clientX - rect.left, y: event.clientY - rect.top};
  }

  /**
   * Changes the photo zoom while preserving the selected point and constraining pan.
   *
   * @param {*} next Next candidate state or entry.
   * @param {*=} point Optional anchor in viewport pixels; defaults to the viewport center.
   */
  function zoomTo(next, point) {
    if (!stage?.isConnected || !image) return;
    const {stage: area, image: picture} = dimensions();
    view = zoomPhotoAt(view, next, point || {x: area.width / 2, y: area.height / 2}, area, picture);
    render();
  }

  /**
   * Resets zoom or multiplies the current zoom by the supplied factor.
   *
   * @param {*} direction Direction used for traversal or movement.
   */
  function zoom(direction) {
    if (direction === 0) zoomTo(1);
    else zoomTo(view.zoom * direction);
  }

  /**
   * Resets zoom, pan and tracked pointer gestures to the initial view.
   */
  function reset() {
    view = {zoom: 1, x: 0, y: 0};
    pointers.clear();
    lastPinchDistance = null;
    render();
  }

  /**
   * Registers the photo zoom state.
   */
  function attach() {
    stage = typeof document === 'undefined' ? null : document.querySelector('.photo-lightbox-stage');
    image = stage?.querySelector('.photo-lightbox-image') || null;
    if (!stage || !image) return;
    reset();
    image.addEventListener('load', render);
    stage.addEventListener('wheel', (/** @type {WheelEvent} */ event) => {
      event.preventDefault();
      zoomTo(view.zoom * (event.deltaY < 0 ? 1.2 : 1 / 1.2), pointOf(event));
    }, {passive: false});
    stage.addEventListener('dblclick', (/** @type {MouseEvent} */ event) => {
      event.preventDefault();
      zoomTo(view.zoom > 1 ? 1 : 2, pointOf(event));
    });
    stage.addEventListener('pointerdown', (/** @type {PointerEvent} */ event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
      stage.setPointerCapture?.(event.pointerId);
      lastPinchDistance = null;
    });
    stage.addEventListener('pointermove', (/** @type {PointerEvent} */ event) => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (lastPinchDistance) zoomTo(view.zoom * distance / lastPinchDistance, pointOf({clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2}));
        lastPinchDistance = Math.max(distance, 1);
      } else if (view.zoom > 1) {
        const {stage: area, image: picture} = dimensions();
        view = constrainPhotoPan(
          {
            ...view,
            x: view.x + event.clientX - previous.x,
            y: view.y + event.clientY - previous.y,
          },
          area,
          picture
        );
        render();
      }
    });
    /**
     * Removes the released pointer and resets the pinch-distance baseline.
     *
     * @param {!PointerEvent} event Event that triggered this operation.
     */
    const endPointer = event => {
      pointers.delete(event.pointerId);
      lastPinchDistance = null;
    };
    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);
    stage.addEventListener('lostpointercapture', endPointer);
  }
  return {attach, zoom, reset};
}
