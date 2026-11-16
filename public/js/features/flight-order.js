/** Reorder a flight only when the drop changes its sequence. No record copies. */
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

/** Pointer-based dragging works for mouse, touch and pen without native HTML drag ghosts.
 * Only the grip initiates sorting; tapping a whisky still opens its tasting note.
 */
export function bindFlightSorting(root, onReorder) {
    let drag = null;
    const clearTargets = list => {
        for (const row of list.querySelectorAll('.tasting-flight-member')) {
            row.classList.remove('is-dragging', 'is-drop-before', 'is-drop-after');
        }
    };
    const rowUnderPointer = (x, y, list) => {
        const row = document.elementFromPoint(x, y)?.closest?.('.tasting-flight-member');
        return row?.parentElement === list ? row : null;
    };
    const destination = (x, y, list) => {
        const row = rowUnderPointer(x, y, list);
        if (!row) return null;
        const bounds = row.getBoundingClientRect();
        return {row, after:y >= bounds.top + bounds.height / 2};
    };
    function release() {
        if (!drag) return;
        const {handle, pointerId, list} = drag;
        clearTargets(list);
        drag = null;
        if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
    }
    root.addEventListener('pointerdown', event => {
        if (!event.isPrimary || event.button !== 0 || drag) return;
        const handle = event.target.closest?.('[data-flight-drag]');
        const row = handle?.closest('.tasting-flight-member');
        const list = row?.parentElement;
        if (!list?.matches('.tasting-flight-members-list') || !row.dataset.tastingId) return;
        drag = {handle, list, row, pointerId:event.pointerId, x:event.clientX, y:event.clientY, moved:false};
        handle.setPointerCapture?.(event.pointerId);
    });
    root.addEventListener('pointermove', event => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        if (!drag.moved && (event.clientX-drag.x)**2+(event.clientY-drag.y)**2 < 64) return;
        drag.moved = true;
        event.preventDefault();
        clearTargets(drag.list);
        drag.row.classList.add('is-dragging');
        const target = destination(event.clientX, event.clientY, drag.list);
        if (target && target.row !== drag.row)
            target.row.classList.add(target.after ? 'is-drop-after' : 'is-drop-before');
    });
    root.addEventListener('pointerup', event => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        const {row,list,moved} = drag;
        const target = moved ? destination(event.clientX, event.clientY, list) : null;
        if (moved) event.preventDefault();
        release();
        if (target && target.row !== row) void onReorder(row.dataset.tastingId, target.row.dataset.tastingId, target.after);
    });
    root.addEventListener('pointercancel', event => { if (drag?.pointerId === event.pointerId) release(); });
    root.addEventListener('lostpointercapture', event => { if (drag?.pointerId === event.pointerId) release(); });
}
