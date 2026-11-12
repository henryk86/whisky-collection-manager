import { t } from '../i18n/index.js';
import { request } from '../api.js';
import { toast } from '../ui/notifications.js';

/**
 * Photo order is the array order in collection.json, not a separate 'position' field.
 * Desktop: native drag & drop. Touch: pointer-driven drag handle.
 * Keyboard/touch fallback: left/right buttons.
 */
export async function movePhoto(bottleId, photoId, step, action) {
    const list = document.querySelector(`[data-photo-list="${CSS.escape(bottleId)}"]`);
    if (!list) return;
    const ids = [...list.querySelectorAll('[data-photo-tile]')].map(tile => tile.dataset.photoId);
    const from = ids.indexOf(photoId);
    const to = from + step;
    if (from < 0 || to < 0 || to >= ids.length) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    await action(async () => {
        await request(`/api/bottles/${encodeURIComponent(bottleId)}/photos/order`, {
            method: 'PUT', body: JSON.stringify({ photoIds: ids })
        });
        toast(t("features.notifications.photoOrderSaved"));
    });
}

export function attachPhotoSorting(action) {
    for (const list of document.querySelectorAll('[data-photo-list]')) {
        const bottleId = list.dataset.photoList;
        let dragId = null;
        let overTile = null;
        const tiles = () => [...list.querySelectorAll('[data-photo-tile]')];
        const clear = () => {
            for (const tile of tiles()) tile.classList.remove('photo-dragging', 'photo-drop-target');
            dragId = null;
            overTile = null;
        };
        const showTarget = target => {
            for (const tile of tiles()) tile.classList.toggle('photo-drop-target', tile === target);
            overTile = target;
        };
        const commit = async target => {
            const photoId = dragId;
            const ids = tiles().map(tile => tile.dataset.photoId);
            const from = ids.indexOf(photoId);
            const to = ids.indexOf(target?.dataset.photoId);
            clear();
            if (from < 0 || to < 0 || from === to) return;
            ids.splice(to, 0, ids.splice(from, 1)[0]);
            await action(async () => {
                await request(`/api/bottles/${encodeURIComponent(bottleId)}/photos/order`, {
                    method: 'PUT', body: JSON.stringify({ photoIds: ids })
                });
                toast(t("features.notifications.photoOrderSaved"));
            });
        };
        list.addEventListener('dragstart', event => {
            const handle = event.target.closest('[data-photo-drag]');
            if (!handle) return event.preventDefault();
            dragId = handle.closest('[data-photo-tile]').dataset.photoId;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', dragId);
            handle.closest('[data-photo-tile]').classList.add('photo-dragging');
        });
        list.addEventListener('dragover', event => {
            if (!dragId) return;
            const target = event.target.closest('[data-photo-tile]');
            if (target && target.closest('[data-photo-list]') === list) {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                showTarget(target);
            }
        });
        list.addEventListener('drop', event => {
            event.preventDefault();
            void commit(overTile || event.target.closest('[data-photo-tile]'));
        });
        list.addEventListener('dragend', clear);

        // iOS Safari: HTML drag events on custom handles are inconsistent.
        // Pointer Events use a touch-action:none handle and the actual drop position.
        for (const handle of list.querySelectorAll('[data-photo-drag]')) {
            handle.addEventListener('pointerdown', event => {
                if (event.pointerType === 'mouse' || !event.isPrimary) return;
                event.preventDefault();
                dragId = handle.closest('[data-photo-tile]').dataset.photoId;
                handle.setPointerCapture(event.pointerId);
                handle.closest('[data-photo-tile]').classList.add('photo-dragging');
            });
            handle.addEventListener('pointermove', event => {
                if (!dragId || event.pointerType === 'mouse') return;
                const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-photo-tile]');
                if (target && target.closest('[data-photo-list]') === list) showTarget(target);
            });
            handle.addEventListener('pointerup', event => {
                if (!dragId || event.pointerType === 'mouse') return;
                const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-photo-tile]');
                void commit(target && target.closest('[data-photo-list]') === list ? target : overTile);
            });
            handle.addEventListener('pointercancel', clear);
        }
    }
}
