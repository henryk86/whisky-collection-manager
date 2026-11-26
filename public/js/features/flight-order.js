/**
 * Reorder a flight only when the drop changes its sequence. No record copies.
 *
 * @param {!Array<*>} ids Identifiers in their current order.
 * @param {string} sourceId Identifier of the flight member being moved.
 * @param {string} targetId Identifier of the destination photo.
 * @param {boolean=} after Resource data after the mutation.
 * @return {?Array<*>} Reordered flight-member IDs, or null when the requested move does not change the order.
 */
export function reorderFlightIds(ids, sourceId, targetId, after = false) {
  if (!Array.isArray(ids) || sourceId === targetId) return null;
  const source = ids.indexOf(sourceId);
  const target = ids.indexOf(targetId);
  if (source < 0 || target < 0) return null;
  const reordered = [...ids];
  reordered.splice(source, 1);
  const insertAt = reordered.indexOf(targetId) + (after ? 1 : 0);
  reordered.splice(insertAt, 0, sourceId);
  return reordered.every((id, index) => id === ids[index]) ? null : reordered;
}

/**
 * Pointer-based dragging works for mouse, touch and pen without native HTML
 * drag ghosts. Only the grip initiates sorting; tapping a whisky still opens
 * its tasting note.
 *
 * @param {!Element} root Root element or directory.
 * @param {Function} onReorder Called with the updated member order after a valid drag-and-drop operation.
 */
export function bindFlightSorting(root, onReorder) {
  let drag = null;
  /**
   * Removes or resets targets.
   *
   * @param {*} list Collection of entries to process.
   */
  const clearTargets = list => {
    for (const row of list.querySelectorAll('.tasting-flight-member')) {
      row.classList.remove('is-dragging', 'is-drop-before', 'is-drop-after');
    }
  };

  /**
   * Finds the flight member under the viewport coordinates if it belongs to this list.
   *
   * @param {*} x Horizontal coordinate.
   * @param {*} y Vertical coordinate.
   * @param {*} list Collection of entries to process.
   * @return {*} Flight member element belonging to the list, or null if the pointer is elsewhere.
   */
  const rowUnderPointer = (x, y, list) => {
    const row = document.elementFromPoint(x, y)?.closest?.('.tasting-flight-member');
    return row?.parentElement === list ? row : null;
  };

  /**
   * Determines the destination row and whether insertion is before or after its midpoint.
   *
   * @param {*} x Horizontal coordinate.
   * @param {*} y Vertical coordinate.
   * @param {*} list Collection of entries to process.
   * @return {!Object} Destination row and before-or-after insertion flag, or null outside eligible rows.
   */
  const destination = (x, y, list) => {
    const row = rowUnderPointer(x, y, list);
    if (!row) return null;
    const bounds = row.getBoundingClientRect();
    return {row, after: y >= bounds.top + bounds.height / 2};
  };

  /**
   * Clears the active drag state and releases the captured pointer.
   */
  function release() {
    if (!drag) return;
    const {handle, pointerId, list} = drag;
    clearTargets(list);
    drag = null;
    if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
  }
  root.addEventListener('pointerdown', (/** @type {PointerEvent} */ event) => {
    if (!event.isPrimary || event.button !== 0 || drag) return;
    const handle = /** @type {Element} */ (event.target).closest?.('[data-flight-drag]');
    const row = /** @type {HTMLElement} */ (handle?.closest('.tasting-flight-member'));
    const list = row?.parentElement;
    if (!list?.matches('.tasting-flight-members-list') || !row.dataset.tastingId) return;
    drag = {
      handle,
      list,
      row,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
    handle.setPointerCapture?.(event.pointerId);
  });
  root.addEventListener('pointermove', (/** @type {PointerEvent} */ event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.moved && (event.clientX - drag.x) ** 2 + (event.clientY - drag.y) ** 2 < 64) return;
    drag.moved = true;
    event.preventDefault();
    clearTargets(drag.list);
    drag.row.classList.add('is-dragging');
    const target = destination(event.clientX, event.clientY, drag.list);
    if (target && target.row !== drag.row)
      target.row.classList.add(target.after ? 'is-drop-after' : 'is-drop-before');
  });
  root.addEventListener('pointerup', (/** @type {PointerEvent} */ event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const {row, list, moved} = drag;
    const target = moved ? destination(event.clientX, event.clientY, list) : null;
    if (moved) event.preventDefault();
    release();
    if (target && target.row !== row) void onReorder(row.dataset.tastingId, target.row.dataset.tastingId, target.after);
  });
  root.addEventListener(
    'pointercancel',
    (/** @type {PointerEvent} */ event) => {if (drag?.pointerId === event.pointerId) release();}
  );
  root.addEventListener(
    'lostpointercapture',
    (/** @type {PointerEvent} */ event) => {if (drag?.pointerId === event.pointerId) release();}
  );
}
