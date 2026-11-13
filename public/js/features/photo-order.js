import { t } from '../i18n/index.js';
import { request } from '../api.js';
import { toast } from '../ui/notifications.js';

/** Photo order is the array order in collection.json, not a separate position. */
export function reorderedPhotoIds(ids, photoId, targetId) {
    const from = ids.indexOf(photoId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return null;
    const result = [...ids];
    result.splice(to, 0, result.splice(from, 1)[0]);
    return result;
}

async function savePhotoOrder(bottleId, ids, action) {
    await action(async () => {
        await request(`/api/bottles/${encodeURIComponent(bottleId)}/photos/order`, {
            method: 'PUT', body: JSON.stringify({ photoIds: ids })
        });
        toast(t('features.notifications.photoOrderSaved'));
    });
}

/** Accessible left/right buttons work independently of pointer support. */
export async function movePhoto(bottleId, photoId, step, action) {
    const list = document.querySelector(`[data-photo-list="${CSS.escape(bottleId)}"]`);
    if (!list) return;
    const ids = [...list.querySelectorAll('[data-photo-tile]')].map(tile => tile.dataset.photoId);
    const from = ids.indexOf(photoId);
    const order = reorderedPhotoIds(ids, photoId, ids[from + step]);
    if (order) await savePhotoOrder(bottleId, order, action);
}

/**
 * Chrome's native HTML drag-and-drop competes with image dragging and differs
 * from mobile Safari. Pointer capture gives mouse, touch and pen the same
 * deterministic target: the tile physically under the pointer on release.
 * On desktop, photos can also be dragged directly; a normal click still opens
 * the viewer. On touch, only the handle starts a drag so photos remain scrollable.
 */
export function attachPhotoSorting(action) {
    for (const list of document.querySelectorAll('[data-photo-list]')) {
        const bottleId = list.dataset.photoList;
        let gesture = null;
        let saving = false;
        let suppressClick = false;
        const tiles = () => [...list.querySelectorAll('[data-photo-tile]')];
        const tileAt = (x, y) => {
            const tile = document.elementFromPoint(x, y)?.closest('[data-photo-tile]');
            return tile?.closest('[data-photo-list]') === list ? tile : null;
        };
        const showTarget = target => {
            for (const tile of tiles()) tile.classList.toggle('photo-drop-target', tile === target);
        };
        const clear = () => {
            const active = gesture;
            gesture = null;
            for (const tile of tiles()) tile.classList.remove('photo-dragging', 'photo-drop-target');
            if (active?.source.hasPointerCapture?.(active.pointerId)) {
                active.source.releasePointerCapture(active.pointerId);
            }
        };
        const commit = async (photoId, target) => {
            const ids = tiles().map(tile => tile.dataset.photoId);
            const order = reorderedPhotoIds(ids, photoId, target?.dataset.photoId);
            if (!order || saving) return;
            saving = true;
            try { await savePhotoOrder(bottleId, order, action); }
            finally { saving = false; }
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
                startX: event.clientX, startY: event.clientY, moved: false, source
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
                setTimeout(() => { suppressClick = false; }, 0);
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
