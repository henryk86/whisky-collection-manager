import {adjustPhotoPixels} from './adjustments.js';

/**
 * Paints the current source and schedules generation-safe preview updates.
 * @param {!Object} options Editor session and root element resolver.
 * @return {!Object} Preview update operations.
 */
export function createPhotoPreview({session, root}) {
  /**
   * Locates the DOM elements used by paint preview.
   */
  function paintPreview() {
    const host = root();
    if (!host || !session.sourceData) return;
    const canvas = host.querySelector('[data-photo-editor-preview]');
    if (!canvas) return;
    // The comparison must switch canvas pixels before aria-pressed / UI state
    // advertises completion; otherwise browser assertions and users briefly
    // see the previous (potentially transparent) frame.
    const adjusted = session.showingBefore
      ? (session.previewCutout ? session.originalPreviewData || session.sourceData : session.sourceData)
      : adjustPhotoPixels(session.sourceData, session.values);
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
    const thisGeneration = session.generation;
    if (session.renderId) cancelAnimationFrame(session.renderId);
    session.renderId = requestAnimationFrame(() => {
      session.renderId = 0;
      if (thisGeneration === session.generation) paintPreview();
    });
  }

  /**
   * Renders preview now in the current view.
   */
  function showPreviewNow() {
    if (session.renderId) cancelAnimationFrame(session.renderId);
    session.renderId = 0;
    paintPreview();
  }

  return {schedulePreview, showPreviewNow};
}
