/**
 * Pointer-based bottle relocation inside a rack or across the room-wide
 * virtual shelf wall. Reuses the existing server assignment endpoint; no local
 * warehouse mutations. Pointer Events cover mouse, pen and touch while
 * click/keyboard still open details.
 *
 * @param {!Object} warehouse Warehouse model being processed.
 * @param {string} bottleId Identifier of the physical bottle.
 * @param {*} targetShelfId Target shelf id used by this operation.
 * @return {(string)} Entries that meet the selection criteria.
 */
export function shelfDropStatus(warehouse, bottleId, targetShelfId) {
  const selected = Array.isArray(bottleId) ? bottleId : [bottleId];
  if (!selected.length || new Set(selected).size !== selected.length) return 'invalid';
  const known = new Set((warehouse?.bottles || []).map(bottle => bottle.id));
  if (selected.some(id => !known.has(id))) return 'invalid';
  const shelves = (warehouse.rooms || []).flatMap(room => (room.furniture || []).flatMap(furniture => furniture.shelves || []));
  const shelf = shelves.find(item => item.id === targetShelfId);
  if (!shelf) return 'invalid';
  if (selected.every(id => warehouse.assignments?.[id] === targetShelfId)) return 'same';
  if (shelf.capacity !== null && shelf.capacity !== undefined) {
    const chosen = new Set(selected);
    const otherOccupants = Object.entries(warehouse.assignments || {}).filter(([id, assigned]) =>
      assigned === targetShelfId && !chosen.has(id) && known.has(id)).length;
    if (otherOccupants + selected.length > shelf.capacity) return shelf.capacity === 0 ? 'full' : 'expand';
  }
  return 'valid';
}

/**
 * Registers the drag interaction for placing bottles in warehouse shelves.
 *
 * @param {*} panel Panel used by this operation.
 * @param {!Object=} options2 Destructured options for this operation.
 * @return {!Object} Structured result for the caller.
 */
export function mountWarehouseBottleDrag(panel, {getWarehouse, onDrop,
  onInvalidDrop, getDraggedIds} = {}) {
  if (!panel?.addEventListener || typeof getWarehouse !== 'function' || typeof onDrop !== 'function') return () => {};
  const threshold = 8;
  let active = null;
  let suppressClickFor = null;
  let suppressTimer = null;
  let busy = false;
  let scrollTimer = null;
  let scrollDirection = 0;

  /**
   * Removes or resets targets.
   */
  function clearTargets() {
    for (const node of panel.querySelectorAll('.warehouse-shelf')) {
      node.classList.remove('warehouse-drop-target', 'warehouse-drop-blocked', 'warehouse-drop-capacity');
    }
  }

  /**
   * Updates the end state for its caller.
   */
  function end() {
    clearInterval(scrollTimer);
    scrollTimer = null;
    scrollDirection = 0;
    if (active) {
      active.button.classList.remove('warehouse-bottle-dragging');
      active.ghost?.remove();
      try {
        active.button.releasePointerCapture?.(active.pointerId);
      } catch { /* capture can be lost on cancel */}
    }
    active = null;
    panel.classList.remove('warehouse-is-dragging');
    clearTargets();
  }

  /**
   * Derives the destination at result from the supplied values.
   *
   * @param {*} x Horizontal coordinate.
   * @param {*} y Vertical coordinate.
   * @return {*} Result computed from the supplied inputs.
   */
  function destinationAt(x, y) {
    const node = panel.ownerDocument?.elementFromPoint?.(x, y)?.closest?.('.warehouse-shelf');
    return node && panel.contains(node) ? node : null;
  }

  /**
   * Updates element attributes used by mark destination.
   *
   * @param {*} x Horizontal coordinate.
   * @param {*} y Vertical coordinate.
   */
  function markDestination(x, y) {
    clearTargets();
    const target = destinationAt(x, y);
    const status = target ? shelfDropStatus(getWarehouse(), active.bottleIds, target.dataset.shelfId) : null;
    if (target) target.classList.add(status === 'valid' ?
      'warehouse-drop-target' : status === 'expand' ? 'warehouse-drop-capacity' : 'warehouse-drop-blocked');
  }

  /**
   * Controls wall for warehouse bottle drag.
   *
   * @param {number} x Horizontal coordinate in the current coordinate system.
   * @param {number} y Vertical coordinate in the current coordinate system.
   */
  function scrollWall(x, y) {
    const viewport = panel.querySelector?.('.warehouse-wall-scroll');
    let directionX = 0;
    if (viewport?.getBoundingClientRect) {
      const rect = viewport.getBoundingClientRect();
      if (y >= rect.top && y <= rect.bottom && x >= rect.left && x <= rect.right) {
        if (x < rect.left + 45) directionX = -1;
        else if (x > rect.right - 45) directionX = 1;
      }
    }
    if (directionX === scrollDirection) return;
    clearInterval(scrollTimer);
    scrollTimer = null;
    scrollDirection = directionX;
    if (!directionX) return;
    /**
     * Derives the tick result from the supplied values.
     */
    const tick = () => {
      if (!active?.moved) return;
      viewport.scrollLeft += directionX * 22;
      markDestination(active.lastX, active.lastY);
    };
    tick();
    scrollTimer = setInterval(tick, 50);
  }

  /**
   * Updates element attributes used by down.
   *
   * @param {!Event} event Event that triggered this operation.
   */
  const down = event => {
    if (busy || active || !event.isPrimary || event.button !== 0) return;
    const button = event.target.closest?.('.warehouse-bottle-symbol');
    if (!button || !panel.contains(button)) return;
    active = {
      button,
      bottleId: button.dataset.id,
      bottleIds: typeof getDraggedIds === 'function' ? getDraggedIds(button.dataset.id) : [button.dataset.id],
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
    try {
      button.setPointerCapture?.(event.pointerId);
    } catch { /* pointer capture may not be available */}
  };

  /**
   * Calculates the move numeric value.
   *
   * @param {!Event} event Event that triggered this operation.
   */
  const move = event => {
    if (!active || event.pointerId !== active.pointerId) return;
    if (!active.moved && Math.hypot(event.clientX - active.x, event.clientY - active.y) < threshold) return;
    if (!active.moved) {
      active.moved = true;
      active.button.classList.add('warehouse-bottle-dragging');
      panel.classList.add('warehouse-is-dragging');
      // A pointer-captured element stays at its original position. Mirror it
      // above the page so the dragged bottle follows the cursor visibly.
      const ghost = active.button.cloneNode?.(true);
      if (ghost && panel.ownerDocument?.body?.appendChild) {
        ghost.removeAttribute?.('data-act');
        ghost.removeAttribute?.('data-id');
        ghost.setAttribute?.('aria-hidden', 'true');
        ghost.classList.add('warehouse-drag-avatar');
        panel.ownerDocument.body.appendChild(ghost);
        active.ghost = ghost;
      }
    }
    event.preventDefault();
    active.lastX = event.clientX;
    active.lastY = event.clientY;
    if (active.ghost) {
      active.ghost.style.left = `${event.clientX - 24}px`;
      active.ghost.style.top = `${event.clientY - 65}px`;
    }
    markDestination(event.clientX, event.clientY);
    scrollWall(event.clientX, event.clientY);
  };

  /**
   * Updates element attributes used by up.
   *
   * @param {!Event} event Event that triggered this operation.
   */
  const up = event => {
    if (!active || event.pointerId !== active.pointerId) return;
    const {bottleId, bottleIds, moved} = active;
    // Recalculate at the released position, not the last pointermove
    // coordinate.
    const target = moved ? destinationAt(event.clientX, event.clientY) : null;
    const shelfId = target?.dataset.shelfId;
    const status = shelfId ? shelfDropStatus(getWarehouse(), bottleIds, shelfId) : 'invalid';
    end();
    if (!moved) return;
    // Browser-generated click after pointerup must not open the detail modal.
    suppressClickFor = bottleId;
    clearTimeout(suppressTimer);
    suppressTimer = setTimeout(() => {suppressClickFor = null;}, 350);
    event.preventDefault();
    if (status === 'same') return;
    if (status !== 'valid' && status !== 'expand') {onInvalidDrop?.(status); return;}
    busy = true;
    Promise.resolve().then(() => onDrop(bottleIds.length === 1 ? bottleIds[0] : bottleIds, shelfId)).catch(error => {
      console.error('Bottle relocation failed:', error);
    }).finally(() => {busy = false;});
  };

  /**
   * Performs the cancel lifecycle action.
      * @return {*} Result of this expression.
*/
  const cancel = () => end();

  /**
   * Updates element attributes used by click.
   *
   * @param {!Event} event Event that triggered this operation.
   */
  const click = event => {
    const button = event.target.closest?.('.warehouse-bottle-symbol');
    if (button && button.dataset.id === suppressClickFor) {
      event.preventDefault();
      event.stopImmediatePropagation?.();
      event.stopPropagation?.();
      suppressClickFor = null;
    }
  };
  panel.addEventListener('pointerdown', down);
  panel.addEventListener('pointermove', move);
  panel.addEventListener('pointerup', up);
  panel.addEventListener('pointercancel', cancel);
  panel.addEventListener('lostpointercapture', cancel);
  panel.addEventListener('click', click, true);
  return () => {
    end(); clearTimeout(suppressTimer);
    for (const [name, fn, options] of [
      ['pointerdown', down],
      ['pointermove', move],
      ['pointerup', up],
      ['pointercancel', cancel],
      ['lostpointercapture', cancel],
      ['click', click, true],
    ]) {
      panel.removeEventListener(name, fn, options);
    }
  };
}
