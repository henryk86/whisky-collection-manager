import { escapeHtml, query, queryAll } from './ui/dom.js';
import { chooseLanguage, t } from './i18n/index.js';
import { request } from './api.js';
import { toast } from './ui/notifications.js';
import { movePhoto } from './features/photo-order.js';
import { routeUrl } from './navigation/routes.js';
import { readAnalyticsDate } from './domain/analytics-period.js';
/** One delegated click handler; HTML data-act values are the UI action names. */
export function bindEvents(root, { state, render, action, navigate, editors, settings, backup, scanner, whiskybase, modal, photoViewer, cutout, theme, resolveCode, warehouseView }) {
    const suggestNumber = async (fieldName) => {
        const result = await request('/api/suggest-number');
        const field = query(`[name=${fieldName}]`);
        if (field) {
            field.value = result.number;
        }
    };
    let pendingConfirmation = null;
    function confirmInModal(title, message, task, buttonLabel = 'Endgültig löschen') {
        pendingConfirmation = task;
        modal.showModal(title, `<p>${escapeHtml(message)}</p>
    <div class="actions" style="justify-content:flex-end;margin-top:22px">
    <button type="button" class="btn" data-act="close-modal">${t("common.actions.cancel")}</button>
    <button type="button" class="btn danger" data-act="confirm-action">${escapeHtml(buttonLabel)}</button>
    </div>`);
    }
    function setMenu(open) {
        const drawer = document.getElementById('site-drawer');
        const backdrop = document.querySelector('.site-drawer-backdrop');
        const button = document.getElementById('menu-button');
        if (!drawer || !backdrop || !button) return;
        drawer.hidden = !open;
        backdrop.hidden = !open;
        button.setAttribute('aria-expanded', String(open));
        if (open) drawer.querySelector('[data-act="close-menu"]')?.focus();
        else button.focus();
    }
    const handlers = {
        'toggle-menu': () => setMenu(document.getElementById('site-drawer')?.hidden !== false),
        'close-menu': () => setMenu(false),
        'goto-home': () => navigate('home'),
        'goto-map': () => navigate('map'),
        'bottling-map': () => navigate('map', state.selected),
        'goto-analysis': () => navigate('analytics', 'overview'),
        'goto-warehouse': () => navigate('warehouse', 'overview'),
        'warehouse-section': button => navigate('warehouse', button.dataset.section),
        'warehouse-plan-mode': button => {state.warehousePlanMode = button.dataset.mode === '3d' ? '3d' : '2d'; render();},
        'warehouse-camera': button => { if (['nw','ne','se','sw'].includes(button.dataset.corner)) {state.warehousePlanCorner = button.dataset.corner; render();} },
        'warehouse-visibility-toggle': button => warehouseView.toggleFurnitureVisibility(button.dataset.id),
        'warehouse-show-all': () => warehouseView.showAllFurniture(),
        'warehouse-find': () => navigate('warehouse', 'find'),
        'warehouse-room-new': () => warehouseView.openForm('room'),
        'warehouse-room-edit': button => warehouseView.openForm('room', button.dataset.id),
        'warehouse-room-delete': button => warehouseView.askDelete('room', button.dataset.id),
        'warehouse-select-room': button => warehouseView.selectRoom(button.dataset.id),
        'warehouse-furniture-new': () => warehouseView.openForm('furniture'),
        'warehouse-bulk-select-all': () => warehouseView.selectAllFurniture(),
        'warehouse-bulk-clear': () => warehouseView.clearFurnitureSelection(),
        'warehouse-bulk-edit': () => warehouseView.openForm('furniture-bulk'),
        'warehouse-bulk-delete': () => warehouseView.askBulkDelete(),
        'warehouse-furniture-edit': button => warehouseView.openForm('furniture', button.dataset.id),
        'warehouse-furniture-copy': button => warehouseView.openForm('furniture-copy', button.dataset.id),
        'warehouse-furniture-delete': button => warehouseView.askDelete('furniture', button.dataset.id),
        'warehouse-select-furniture': button => warehouseView.selectFurniture(button.dataset.id),
        'warehouse-shelf-new': button => warehouseView.openForm('shelf', button.dataset.id),
        'warehouse-shelf-up': button => warehouseView.moveShelf(button.dataset.id,'up'),
        'warehouse-shelf-down': button => warehouseView.moveShelf(button.dataset.id,'down'),
        'warehouse-shelf-edit': button => warehouseView.openForm('shelf', button.dataset.id),
        'warehouse-shelf-copy': button => warehouseView.openForm('shelf-copy', button.dataset.id),
        'warehouse-shelf-delete': button => warehouseView.askDelete('shelf', button.dataset.id),
        'warehouse-assign': button => warehouseView.openForm('assign', button.dataset.id),
        'warehouse-bottle-preview': button => warehouseView.openBottlePreview(button.dataset.id),
        'warehouse-focus': button => {
            const place = state.warehouse?.rooms.find(r => r.furniture.some(f => f.shelves.some(s => s.id === button.dataset.id)));
            if (!place) return navigate('warehouse', 'find');
            state.warehouseRoomId=place.id;
            state.warehouseFurnitureId=place.furniture.find(f=>f.shelves.some(s=>s.id===button.dataset.id)).id;
            navigate('warehouse', 'shelves');
        },
        'warehouse-confirm-delete': () => warehouseView.deleteConfirmed(),
        'analytics-section': button => navigate('analytics', button.dataset.section),
        'analytics-reset': () => {
            state.analyticsFilters = { distillery: 'all', country: 'all', volumeType: 'all', status: 'all' };
            state.analyticsPeriod = 'month'; state.analyticsStartDate = ''; state.analyticsEndDate = '';
            history.replaceState({ whiskyRoute: true }, '', routeUrl('analytics', state.selected));
            render();
        },
        'analytics-distillery': button => {
            state.distillery = button.dataset.id; state.pageNumber = 1; navigate('home');
        },
        'analytics-drill-filter': button => {
            if (button.dataset.kind === 'country') {
                state.analyticsFilters.country = button.dataset.value;
                history.replaceState({ whiskyRoute: true }, '', routeUrl('analytics', state.selected, state.analyticsFilters));
                render(); return;
            }
            if (button.dataset.kind === 'status' && ['closed', 'open', 'empty'].includes(button.dataset.value)) state.status = button.dataset.value;
            else if (button.dataset.kind === 'volumeType' && ['standard', 'sample'].includes(button.dataset.value)) state.volumeType = button.dataset.value;
            state.pageNumber = 1; navigate('home');
        },
        'goto-settings-menu': async () => { navigate('settings'); if (state.backupUnlocked) await backup.refresh(true); },
        'find-distillery-location': () => settings.findDistilleryLocation(),
        'apply-distillery-location': button => settings.applyDistilleryLocation(button),
        'toggle-theme': () => theme.toggleTheme(),
        'backup-refresh': () => backup.refresh(),
        'backup-manual-download': () => backup.downloadManual(),
        'backup-lock': () => backup.lock(),
        'backup-new': () => backup.edit(),
        'backup-edit': button => backup.edit(button.dataset.id),
        'backup-run': button => backup.job(button.dataset.id, 'run'),
        'backup-test': button => backup.job(button.dataset.id, 'test'),
        'backup-check': button => backup.job(button.dataset.id, 'check'),
        'backup-snapshots': button => backup.job(button.dataset.id, 'snapshots'),
        'backup-restore': button => backup.restore(button.dataset.id),
        'backup-prepare': button => backup.job(button.dataset.id, 'prepare', { snapshotId: button.dataset.file }),
        'backup-download-prepared': button => backup.downloadPrepared(button.dataset.id),
        'backup-download': button => backup.download(button.dataset.id, button.dataset.file),
        'backup-delete': button => backup.remove(button.dataset.id),
        'backup-confirm-delete': button => backup.confirmDelete(button.dataset.id),
        'suggest-first': () => suggestNumber('firstInventoryNumber'),
        'suggest-bottle': () => suggestNumber('inventoryNumber'),
        'wb-apply': () => whiskybase.wbApply(),
        'wb-import-continue': () => whiskybase.confirmPendingImport(),
        'wb-existing-bottle': () => editors.newBottle(true),
        'wb-existing-photo': () => whiskybase.attachToExistingBottle(),
        'wb-existing-edit': () => whiskybase.editExisting(),
        new: () => editors.newBottling(),
        'new-bottling-direct': () => editors.createBottling(),
        back: () => navigate('home'),
        open: button => {
            const bottleId = button.dataset.bottleId || null;
            navigate('detail', button.dataset.id, { highlightBottleId: bottleId });
            // In bottle mode show the chosen physical bottle, not only its parent bottling.
            if (bottleId) document.getElementById(`bottle-${bottleId}`)?.scrollIntoView({ block: 'center', behavior: 'auto' });
        },
        'toggle-view': () => {
            state.view = state.view === 'cards' ? 'table' : 'cards';
            render();
        },
        'edit-bottling': () => editors.editBottling(),
        'add-bottle': () => editors.newBottle(),
        'edit-bottle': button => editors.editBottle(button.dataset.id),
        'close-modal': () => modal.closeModal(),
        'add-distillery': () => settings.promptDistillery(),
        'rename-distillery': button => settings.promptDistillery(button.dataset.id),
        scan: () => scanner.scanCode(),
        'scan-into-bottle': () => scanner.scanCode(true),
        'submit-code': button => resolveCode(query('[name=manualCode]').value, button.dataset.assign === '1'),
        'confirm-action': async () => {
            const task = pendingConfirmation;
            pendingConfirmation = null;
            modal.closeModal(true);
            if (task) await task();
        },
        'confirm-import': () => settings.confirmImport(),
        'delete-file': button => confirmInModal(t("ui.confirmations.deleteAttachment"), t("ui.confirmations.deleteAttachmentQuestion"), () => action(async () => {
            await request(`/api/bottles/${encodeURIComponent(button.dataset.id)}/files/${encodeURIComponent(button.dataset.fileId)}`, { method: 'DELETE' });
            toast(t("ui.confirmations.attachmentDeleted"));
        })),
        'open-photo': button => photoViewer.open(button),
        'cutout-open': button => cutout.open(button),
        'cutout-generate': () => cutout.generate(),
        'cutout-save': () => cutout.save(),
        'cutout-toggle': () => cutout.toggle(),
        'cutout-remove': () => cutout.remove(),
        'photo-prev': () => photoViewer.step(-1),
        'photo-next': () => photoViewer.step(1),
        'move-photo': button => movePhoto(button.dataset.id, button.dataset.photoId, Number(button.dataset.dir), action),
        'delete-photo': button => confirmInModal(t("ui.confirmations.deletePhoto"), t("ui.confirmations.deletePhotoQuestion"), () => action(async () => {
            await request(`/api/bottles/${encodeURIComponent(button.dataset.id)}/photos/${encodeURIComponent(button.dataset.photoId)}`, { method: 'DELETE' });
            toast(t("ui.confirmations.photoDeleted"));
        })),
        'delete-bottle': button => confirmInModal(t("ui.confirmations.deleteBottle"), t("ui.confirmations.deleteBottleQuestion"), () => action(async () => {
            await request(`/api/bottles/${encodeURIComponent(button.dataset.id)}`, { method: 'DELETE' });
            toast(t("ui.confirmations.bottleDeleted"));
        })),
        'delete-bottling': () => confirmInModal(t("ui.confirmations.deleteBottling"), t("ui.confirmations.deleteBottlingQuestion"), () => action(async () => {
            await request(`/api/bottlings/${encodeURIComponent(state.selected)}`, { method: 'DELETE' });
            navigate('home', null, { replace: true });
            toast(t("ui.confirmations.bottlingDeleted"));
        })),
        import: () => settings.importJSON(),
    };
    root.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-act]');
        if (!button || button.disabled) {
            return;
        }
        if (button.tagName === 'A') {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
        }
        try {
            await handlers[button.dataset.act]?.(button);
        }
        catch (error) {
            toast(error.message, true);
        }
    });
    root.addEventListener('submit', event => {
        if (event.target.id === 'new-bottle-choice-form') {
            event.preventDefault();
            try { editors.chooseExistingBottling(event.target.elements.bottlingId.value); }
            catch (error) { toast(error.message, true); }
            return;
        }
        if (event.target.id === 'warehouse-form') {
            warehouseView.submit(event);
            return;
        } else if (event.target.id === 'backup-password-form') {
            backup.setPassword(event).catch(error => toast(error.message, true));
        } else if (event.target.id === 'backup-unlock-zip-form') {
            backup.unlockPrepared(event).catch(error => toast(error.message, true));
        } else if (event.target.id === 'backup-import-zip-form') {
            backup.uploadZip(event).catch(error => toast(error.message, true));
        } else if (event.target.id === 'backup-apply-zip-form') {
            backup.applyZip(event).catch(error => toast(error.message, true));
        } else if (event.target.id === 'backup-unlock-form') {
            backup.unlock(event).catch(error => toast(error.message, true));
        } else if (event.target.id === 'backup-profile-form') {
            backup.save(event).catch(error => toast(error.message, true));
        } else if (event.target.id === 'backup-restore-form') {
            backup.submitRestore(event).catch(error => toast(error.message, true));
        } else if (event.target.id === 'collection-settings-form') {
            settings.saveCollectionSettings(event).catch(error => toast(error.message, true));
        } else if (event.target.id === 'distillery-form') {
            settings.saveDistillery(event).catch(error => toast(error.message, true));
        } else {
            editors.handleForm(event).catch(error => toast(error.message, true));
        }
    });
    root.addEventListener('change', event => {
        if (event.target.id === 'ui-language') { chooseLanguage(event.target.value); return; }
        if (event.target.name === 'type' && event.target.closest?.('#warehouse-form')?.dataset.newFurniture === 'true') {
            const form = event.target.closest('#warehouse-form');
            const bottom = form.querySelector('[name="elevation"]');
            const height = form.querySelector('[name="itemHeight"]');
            if (bottom && height) {
                if (event.target.value === 'haengeregal' && Number(bottom.value) === 0 && Number(height.value) === 1.8) {
                    bottom.value = '1.9'; height.value = '0.4';
                } else if (event.target.value !== 'haengeregal' && Number(bottom.value) === 1.9 && Number(height.value) === 0.4) {
                    bottom.value = '0'; height.value = '1.8';
                }
            }
            return;
        }
        if (event.target.matches('.warehouse-bulk-check')) {warehouseView.toggleFurnitureSelection(event.target.dataset.id,event.target.checked);return;}
        if (event.target.id === 'warehouse-room-select') { warehouseView.selectRoom(event.target.value, state.selected === 'shelves' ? 'shelves' : 'rooms'); return; }
        if (event.target.id === 'warehouse-plan-layer') { state.warehousePlanLevel=event.target.value; render(); return; }
        if (event.target.id === 'warehouse-plan-zoom') { state.warehousePlanZoom = [100,150,200].includes(Number(event.target.value)) ? Number(event.target.value) : 100; warehouseView.update3DZoom(state.warehousePlanZoom); return; }
        if (event.target.id === 'warehouse-unassigned') { state.warehouseUnassigned=event.target.checked; render(); return; }
        const filter = event.target.dataset.analyticsFilter;
        if (filter && ['distillery', 'country', 'volumeType', 'status'].includes(filter)) {
            state.analyticsFilters[filter] = event.target.value;
            history.replaceState({ whiskyRoute: true }, '', routeUrl('analytics', state.selected, state.analyticsFilters));
            render();
            return;
        }
        if (event.target.id === 'analytics-period') { state.analyticsPeriod = event.target.value === 'year' ? 'year' : 'month'; render(); return; }
        if (event.target.dataset.analyticsBoundary) {
            const boundary = event.target.dataset.analyticsBoundary;
            if (boundary === 'start' || boundary === 'end') {
                const key = boundary === 'start' ? 'analyticsStartDate' : 'analyticsEndDate';
                state[key] = readAnalyticsDate(event.target.value);
                render();
                return;
            }
        }
        if (event.target.matches('#backup-profile-form [name=provider]')) backup.toggleFields(event.target.form);
        if (event.target.id === 'scan-file') {
            scanner.scanImage(event.target.files?.[0]);
        }
    });
    root.addEventListener('input', event => {
        if (event.target.id === 'warehouse-search') {state.warehouseSearch=event.target.value;warehouseView.filterSearch();return;}
        if (event.target.id === 'bottling-choice-search') {
            editors.filterExistingBottlings(event.target.value);
        }
        if (event.target.id === 'distillery-search') {
            state.distillerySearch = event.target.value;
            const term = state.distillerySearch.trim().toLocaleLowerCase('de');
            const list = query('.distillery-list');
            if (!list) return;
            let count = 0;
            const rows = queryAll('.distillery-row', list);
            for (const row of rows) {
                const match = row.querySelector('strong').textContent.toLocaleLowerCase('de').includes(term);
                row.hidden = !match;
                if (match) count++;
            }
            const counter = query('#distillery-count');
            if (counter) counter.textContent = `${count} von ${rows.length}`;
            const empty = query('.distillery-no-results', list);
            if (empty) empty.hidden = count > 0;
            list.scrollTop = 0;
        }
        if (event.target.matches('.distillery-filter')) {
            const term = event.target.value.trim().toLocaleLowerCase('de');
            const panel = event.target.parentElement;
            queryAll('.distillery-option', panel).forEach(label => {
                const checked = label.querySelector('input').checked;
                label.hidden = !checked && !label.textContent.toLocaleLowerCase('de').includes(term);
            });
        }
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && state.modal) {
            modal.closeModal();
        } else if (event.key === 'Escape' && document.getElementById('site-drawer')?.hidden === false) {
            setMenu(false);
        }
        if (photoViewer.isOpen() && event.key === 'ArrowLeft') {
            event.preventDefault();
            photoViewer.step(-1);
        } else if (photoViewer.isOpen() && event.key === 'ArrowRight') {
            event.preventDefault();
            photoViewer.step(1);
        }
        // Non-button cards/brand elements also support keyboard activation.
        if (['Enter', ' '].includes(event.key) && event.target.matches('.whisky-card, .brand, tr.clickable[data-act], .warehouse-iso-object')) {
            event.preventDefault();
            event.target.click();
        }
    });
}
