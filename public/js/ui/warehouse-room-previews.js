import {t} from '../i18n/index.js';
import {buildWarehouseThreeScene, frameWarehouseCamera}
  from './warehouse-three-scene.js';

const PREVIEW_WIDTH = 360;
const PREVIEW_HEIGHT = 210;
// A room keeps its snapshot while the same warehouse data and theme are in use.
// Weak keys do not retain old rooms after an API refresh.
const snapshots = new WeakMap();

/**
 * Create small, static images of the real 3D scene for visible overview cards.
 * A single temporary WebGL context renders the queued cards one at a time. No
 * OrbitControls, pointer handlers or permanent WebGL canvases are created.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!Object} Structured result for the caller.
 */
export function mountWarehouseRoomPreviews({rooms, warehouse}) {
  if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return {
    /**
     * Performs the dispose lifecycle action.
     */
    dispose() {},
  };
  const previews = [...document.querySelectorAll('.warehouse-room-preview[data-preview-room-id]')];
  if (!previews.length) return {
    /**
     * Performs the dispose lifecycle action.
     */
    dispose() {},
  };

  const roomById = new Map(rooms.map(room => [String(room.id), room]));
  const queue = new Set();
  let disposed = false;
  let rendering = false;
  let observer;
  let themeObserver;
  /**
   * Derives the theme result from the supplied values.
   * @return {*} Result computed from the supplied inputs.
   */
  const theme = () => document.documentElement?.dataset?.theme === 'dark' ? 'dark' : 'light';

  /**
   * Renders image in the current view.
   *
   * @param {*} node Node to inspect or update.
   * @param {*} url URL of the resource being processed.
   */
  function showImage(node, url) {
    if (disposed || !node.isConnected) return;
    let img = node.querySelector('img');
    if (!img) {
      img = document.createElement('img');
      img.alt = ''; // The parent card already contains the room's accessible name.
      img.decoding = 'async';
      node.replaceChildren(img);
    }
    img.src = url;
    node.dataset.previewState = 'ready';
  }

  /**
   * Builds the localized unavailable text for the current language.
   *
   * @param {*} node Node to inspect or update.
   */
  function unavailable(node) {
    if (disposed || !node.isConnected) return;
    node.textContent = t('warehouse.preview.unavailable');
    node.dataset.previewState = 'unavailable';
  }

  /**
   * Updates element attributes used by enqueue.
   *
   * @param {*} node Node to inspect or update.
   */
  function enqueue(node) {
    if (disposed || !node.isConnected) return;
    const room = roomById.get(node.dataset.previewRoomId);
    if (!room) return;
    const cached = snapshots.get(room);
    const activeTheme = theme();
    if (cached?.warehouse === warehouse && cached.theme === activeTheme) {
      showImage(node, cached.url);
      return;
    }
    queue.add(node);
    if (!rendering) void flush();
  }

  /**
   * Coordinates asynchronous work for flush.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function flush() {
    if (rendering || disposed || queue.size === 0) return;
    rendering = true;
    let renderer;
    try {
      const THREE = await import('/vendor/three.module.js');
      if (disposed) return;
      const canvas = document.createElement('canvas');
      renderer = new THREE.WebGLRenderer({
        canvas, antialias: true, preserveDrawingBuffer: true,
        powerPreference: 'low-power',
      });
      renderer.setPixelRatio(1);
      renderer.setSize(PREVIEW_WIDTH, PREVIEW_HEIGHT, false);
      while (!disposed && queue.size) {
        const node = queue.values().next().value;
        queue.delete(node);
        if (!node.isConnected) continue;
        const room = roomById.get(node.dataset.previewRoomId);
        if (!room) continue;
        const activeTheme = theme();
        const cached = snapshots.get(room);
        if (cached?.warehouse === warehouse && cached.theme === activeTheme) {
          showImage(node, cached.url);
          continue;
        }
        let model;
        try {
          model = buildWarehouseThreeScene(THREE, room, warehouse, {theme: activeTheme});
          const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
          frameWarehouseCamera(THREE, camera, model.roomWidth, model.roomDepth,
            model.maxHeight, 'nw', PREVIEW_WIDTH / PREVIEW_HEIGHT);
          renderer.render(model.scene, camera);
          const url = canvas.toDataURL('image/png');
          snapshots.set(room, {warehouse, theme: activeTheme, url});
          // A theme switch during generation queues this card again.
          if (activeTheme === theme()) showImage(node, url);
          else queue.add(node);
        } catch (error) {
          console.warn('3D-Raumvorschau fehlgeschlagen:', error);
          unavailable(node);
        } finally {
          model?.dispose();
        }
        // Yield between rooms so the main interface remains responsive.
        if (queue.size) await new Promise(resolve => setTimeout(resolve, 0));
      }
    } catch (error) {
      console.warn('3D-Raumvorschau nicht verfügbar:', error);
      for (const node of queue) unavailable(node);
      queue.clear();
    } finally {
      renderer?.dispose();
      renderer?.forceContextLoss();
      rendering = false;
      if (!disposed && queue.size) void flush();
    }
  }

  if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        observer.unobserve(entry.target);
        enqueue(entry.target);
      }
    }, {rootMargin: '250px'});
    for (const node of previews) observer.observe(node);
  } else {
    for (const node of previews) enqueue(node);
  }
  if (typeof MutationObserver !== 'undefined' && document.documentElement) {
    themeObserver = new MutationObserver(() => {
      for (const node of previews) {
        if (observer) observer.observe(node); // lazily repaint in the new theme
        else enqueue(node);
      }
    });
    themeObserver.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  }
  return {
    /**
     * Performs the dispose lifecycle action.
     */
    dispose() {
      disposed = true;
      queue.clear();
      observer?.disconnect();
      themeObserver?.disconnect();
    },
  };
}
