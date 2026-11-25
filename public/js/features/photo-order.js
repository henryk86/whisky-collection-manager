import {t} from '../i18n/index.js';
import {request} from '../api.js';
import {toast} from '../ui/notifications.js';

/**
 * Returns a reordered copy of a bottle's photo IDs.
 * Photo order is stored by array position in collection.json. No position
 * property is written. Missing IDs and no-op moves leave the order unchanged.
 *
 * @param {!Array<string>} ids Current photo IDs in display order.
 * @param {string} photoId ID of the photo to move.
 * @param {string} targetId ID of the photo before which it will be inserted.
 * @return {?Array<string>} Updated order, or null if no move is possible.
 */
export function reorderedPhotoIds(ids, photoId, targetId) {
  const from = ids.indexOf(photoId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return null;
  const result = [...ids];
  result.splice(to, 0, result.splice(from, 1)[0]);
  return result;
}

/**
 * Persists a bottle's photo order through the collection mutation wrapper.
 * Displays a confirmation only when the operation succeeds.
 *
 * @param {string} bottleId ID of the physical bottle.
 * @param {!Array<string>} ids Photo IDs in their intended new order.
 * @param {Function} action Mutation wrapper executing the API request.
 * @return {!Promise<void>} Completion of the mutation attempt.
 */
async function savePhotoOrder(bottleId, ids, action) {
  const result = await action(
    () => request(
      `/api/bottles/${encodeURIComponent(bottleId)}/photos/order`,
      {
        method: 'PUT', body: JSON.stringify({photoIds: ids}),
      }
    ),
    {scope: 'collection'}
  );
  if (result.ok) toast(t('features.notifications.photoOrderSaved'));
}

/**
 * Moves a photo by one or more positions with the accessible arrow buttons.
 * This path does not require pointer or drag-and-drop support.
 *
 * @param {string} bottleId ID of the physical bottle.
 * @param {string} photoId ID of the photo being moved.
 * @param {number} step Relative offset in the currently displayed order.
 * @param {Function} action Mutation wrapper executing the API request.
 * @return {!Promise<void>} Completion of the move, if one is possible.
 */
export async function movePhoto(bottleId, photoId, step, action) {
  const list = document.querySelector(`[data-photo-list="${CSS.escape(bottleId)}"]`);
  if (!list) return;
  const ids = [...list.querySelectorAll('[data-photo-tile]')].map(tile => tile.dataset.photoId);
  const from = ids.indexOf(photoId);
  const order = reorderedPhotoIds(ids, photoId, ids[from + step]);
  if (order) await savePhotoOrder(bottleId, order, action);
}

// Track bindings across re-renders so retained photo lists do not accumulate
// duplicate event handlers.
const boundPhotoLists = new WeakSet();

/**
 * Installs pointer-based photo sorting on currently rendered bottle lists.
 * Pointer capture provides the same drop target for mouse, touch and pen.
 * Desktop users can drag the image; touch users start from the drag handle to
 * preserve scrolling. Existing event handlers are not attached twice.
 *
 * @param {Function} action Mutation wrapper used to save the new photo order.
 */
export function attachPhotoSorting(action) {
  for (const list of document.querySelectorAll('[data-photo-list]')) {
    // An unchanged section may be retained across data refreshes.
    if (boundPhotoLists.has(list)) continue;
    boundPhotoLists.add(list);
    const bottleId = list.dataset.photoList;
    let gesture = null;
    let saving = false;
    let suppressClick = false;
    /**
     * Returns photo tiles in their current DOM order.
     *
     * @return {!Array<!Element>} Photo tiles in the active bottle list.
     */
    const tiles = () => [...list.querySelectorAll('[data-photo-tile]')];

    /**
     * Locates a photo tile within this list at the pointer coordinates.
     *
     * @param {number} x Pointer X position in viewport pixels.
     * @param {number} y Pointer Y position in viewport pixels.
     * @return {?Element} Target tile or null when outside the list.
     */
    const tileAt = (x, y) => {
      const tile = document.elementFromPoint(x, y)?.closest('[data-photo-tile]');
      return tile?.closest('[data-photo-list]') === list ? tile : null;
    };

    /**
     * Updates the visual drop target without changing photo order.
     *
     * @param {?Element} target Tile under the pointer, if any.
     */
    const showTarget = target => {
      for (const tile of tiles()) tile.classList.toggle('photo-drop-target', tile === target);
    };

    /**
     * Clears drag state and releases pointer capture after a gesture.
     */
    const clear = () => {
      const active = gesture;
      gesture = null;
      for (const tile of tiles()) tile.classList.remove('photo-dragging', 'photo-drop-target');
      if (active?.source.hasPointerCapture?.(active.pointerId)) {
        active.source.releasePointerCapture(active.pointerId);
      }
    };

    /**
     * Saves a completed drag unless it is a no-op or save is in progress.
     *
     * @param {string} photoId ID of the dragged photo.
     * @param {?Element} target Destination tile, if the pointer is over one.
     * @return {!Promise<void>} Completion of the save attempt.
     */
    const commit = async (photoId, target) => {
      const ids = tiles().map(tile => tile.dataset.photoId);
      const order = reorderedPhotoIds(ids, photoId, target?.dataset.photoId);
      if (!order || saving) return;
      saving = true;
      try {await savePhotoOrder(bottleId, order, action);}
      finally {saving = false;}
    };

    // Never let Chrome start the native image/HTML5 drag operation.
    list.addEventListener('dragstart', event => event.preventDefault());
    list.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || gesture || saving) return;
      const handle = event.target.closest('[data-photo-drag]');
      const photo = event.pointerType === 'mouse' ? event.target.closest('.photo-open') : null;
      const source = handle || photo;
      const tile = source?.closest('[data-photo-tile]');
      if (!tile || tile.closest('[data-photo-list]') !== list) return;
      gesture = {
        pointerId: event.pointerId, photoId: tile.dataset.photoId,
        startX: event.clientX, startY: event.clientY, moved: false, source,
      };
      source.setPointerCapture(event.pointerId);
      if (handle) event.preventDefault();
    });
    list.addEventListener('pointermove', event => {
      const active = gesture;
      if (!active || event.pointerId !== active.pointerId) return;
      const dx = event.clientX - active.startX;
      const dy = event.clientY - active.startY;
      if (!active.moved && dx * dx + dy * dy > 36) {
        active.moved = true;
        active.source.closest('[data-photo-tile]').classList.add('photo-dragging');
      }
      if (!active.moved) return;
      event.preventDefault();
      showTarget(tileAt(event.clientX, event.clientY));
    });
    list.addEventListener('pointerup', event => {
      const active = gesture;
      if (!active || event.pointerId !== active.pointerId) return;
      const target = active.moved ? tileAt(event.clientX, event.clientY) : null;
      // Chrome may synthesize a click after a captured drag, sometimes
      // retargeted to a different tile. Never trigger a photo action then.
      if (active.moved) {
        suppressClick = true;
        setTimeout(() => {suppressClick = false;}, 0);
      }
      clear();
      if (target) void commit(active.photoId, target);
    });
    list.addEventListener('pointercancel', event => {
      if (gesture?.pointerId === event.pointerId) clear();
    });
    list.addEventListener('lostpointercapture', event => {
      if (gesture?.pointerId === event.pointerId) clear();
    });
    list.addEventListener('click', event => {
      if (suppressClick) {
        event.preventDefault();
        event.stopPropagation();
        suppressClick = false;
      }
    }, true);
  }
}
