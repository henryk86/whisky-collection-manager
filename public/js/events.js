import { escapeHtml, query, queryAll } from './ui/dom.js';
import { chooseLanguage, t } from './i18n/index.js';
import { request } from './api.js';
import { toast } from './ui/notifications.js';
import { movePhoto } from './features/photo-order.js';
import { bindFlightSorting } from './features/flight-order.js';
import { routeUrl } from './navigation/routes.js';
import { readAnalyticsDate } from './domain/analytics-period.js';
import { activateHelpTopic } from './views/help.js';
import { activateSettingsSection } from './views/settings.js';
import { handleFlavorRange, setFlavorFromPointer } from './ui/flavor-profile.js';
/** One delegated click handler; HTML data-act values are the UI action names. */
export function bindEvents(root, { state, render, action, navigate, editors, settings, backup, scanner, externalImport, modal, photoViewer, photoEditor, theme, resolveCode, warehouseView, detail, tastingsView, home, mapView, auth }) {
    const suggestNumber = async (fieldName) => {
        const result = await request('/api/suggest-number');
        const field = query(`[name=${fieldName}]`);
        if (field) {
            field.value = result.number;
        }
    };
    let pendingConfirmation = null;
    let confirmationBusy = false;
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
        'goto-tastings-home': () => navigate('tastings-home'),
        'goto-map': () => navigate('map'),
        'goto-help': () => navigate('help'),
        'help-tab': button => activateHelpTopic(button.dataset.helpTopic, button.closest('.help-page')),
        'bottling-map': () => navigate('map', state.selected),
        'goto-analysis': () => navigate('analytics', 'overview'),
        'goto-warehouse': () => navigate('warehouse', 'overview'),
        'warehouse-section': button => navigate('warehouse', button.dataset.section),
        'settings-section': async button => {
            if (activateSettingsSection(button.dataset.settingsSection,button.closest('.settings-page'))) {
                state.settingsSection = button.dataset.settingsSection;
                if (state.settingsSection === 'users') await auth.loadUsers();
            }
        },
        'warehouse-plan-mode': button => {state.warehousePlanMode = ['2d','3d'].includes(button.dataset.mode) ? button.dataset.mode : '2d'; render();},
        'warehouse-camera': button => { if (['nw','ne','se','sw'].includes(button.dataset.corner)) {state.warehousePlanCorner = button.dataset.corner; render();} },
        'warehouse-visibility-toggle': button => warehouseView.toggleFurnitureVisibility(button.dataset.id),
        'warehouse-show-all': () => warehouseView.showAllFurniture(),
        'warehouse-find': () => {state.warehouseFinderPlacement='unassigned';state.warehouseFinderPage=1;navigate('warehouse','find');},
        'warehouse-find-location': button => warehouseView.showBottleLocation(button.dataset.id),
        'warehouse-return-find': () => warehouseView.returnToFinder(),
        'warehouse-find-clear': () => warehouseView.clearFindFocus(),
        'warehouse-find-prev': () => warehouseView.stepFinderPage(-1),
        'warehouse-find-next': () => warehouseView.stepFinderPage(1),
        'warehouse-open-shelves': () => navigate('warehouse', 'shelves'),
        'warehouse-room-new': () => warehouseView.openForm('room'),
        'warehouse-rooms-transfer': () => warehouseView.openRoomTransfer(),
        'warehouse-room-edit': button => warehouseView.openForm('room', button.dataset.id),
        'warehouse-room-delete': button => warehouseView.askDelete('room', button.dataset.id),
        'warehouse-select-room': button => warehouseView.selectRoom(button.dataset.id),
        'warehouse-furniture-new': () => warehouseView.openForm('furniture'),
        'warehouse-furniture-manage': button => warehouseView.openFurnitureManager(button.dataset.id),
        'warehouse-furniture-bulk': () => warehouseView.openFurnitureBulkManager(),
        'warehouse-toggle-furniture': button => warehouseView.toggleFurnitureBulkSelection(button.dataset.id),
        'warehouse-bulk-select-all': () => warehouseView.selectAllFurniture(),
        'warehouse-bulk-clear': () => warehouseView.clearFurnitureSelection(),
        'warehouse-bulk-edit': () => warehouseView.openForm('furniture-bulk'),
        'warehouse-bulk-delete': () => warehouseView.askBulkDelete(),
        'warehouse-furniture-edit': button => warehouseView.openForm('furniture', button.dataset.id),
        'warehouse-furniture-copy': button => warehouseView.openForm('furniture-copy', button.dataset.id),
        'warehouse-furniture-delete': button => warehouseView.askDelete('furniture', button.dataset.id),
        'warehouse-select-furniture': button => warehouseView.selectFurniture(button.dataset.id),
        'warehouse-shelf-new': button => warehouseView.openForm('shelf', button.dataset.id),
        'warehouse-shelf-view': button => warehouseView.openShelfDetails(button.dataset.shelfId || button.dataset.id),
        'warehouse-shelf-up': button => warehouseView.moveShelf(button.dataset.id,'up'),
        'warehouse-shelf-down': button => warehouseView.moveShelf(button.dataset.id,'down'),
        'warehouse-shelf-edit': button => warehouseView.openForm('shelf', button.dataset.id),
        'warehouse-shelf-switch': button => warehouseView.switchShelf(button.dataset.target),
        'warehouse-photo-move': button => warehouseView.moveFurniturePhoto(button.dataset.id,button.dataset.photoId,button.dataset.direction),
        'warehouse-photo-delete': button => warehouseView.deleteFurniturePhoto(button.dataset.id,button.dataset.photoId),
        'warehouse-photo-open': button => warehouseView.openFurniturePhoto(button.dataset.path,button.dataset.title),
        'flavor-detail-undo': () => tastingsView.undoFlavor(),
        'flavor-detail-redo': () => tastingsView.redoFlavor(),
        'tasting-flavor-clear': () => tastingsView.clearFlavor(),
        'tasting-rating': button => tastingsView.chooseRating(Number(button.dataset.ratingPoints)),
        'tasting-rating-clear': () => tastingsView.chooseRating(null),
        'tasting-color': button => tastingsView.chooseColor(button.dataset.colorKey),
        'tasting-color-clear': () => tastingsView.chooseColor(null),
        'tasting-flight-back': () => navigate('tastings-home'),
        'tasting-back-flight': () => state.flightId && navigate('tasting-flight',state.flightId),
        'tasting-open-flight': button => navigate('tasting-flight',button.dataset.flightId),
        'tasting-flight-open': button => navigate('tasting-flight',button.dataset.flightId),
        'tasting-flight-new': () => tastingsView.startFlight(),
        'tasting-flight-create-confirm': () => tastingsView.createFlight(),
        'tasting-flight-edit': () => tastingsView.toggleFlightEdit(true),
        'tasting-flight-cancel-edit': () => tastingsView.toggleFlightEdit(false),
        'tasting-flight-save': () => tastingsView.saveFlight(),
        'tasting-flight-delete': () => confirmInModal(t('tastingFlights.plural'),t('tastingFlights.deleteConfirm'),()=>tastingsView.deleteFlight(),t('common.actions.delete')),
        'tasting-flight-toggle-add': () => tastingsView.toggleFlightAdd(),
        'tasting-flight-attach': () => tastingsView.attachFlightMember(),
        'tasting-flight-remove-note': button => tastingsView.detachFlightMember(button.dataset.tastingId),
        'tasting-flight-move': button => tastingsView.moveFlightMember(Number(button.dataset.index),Number(button.dataset.direction)),
        'tasting-flight-note-open': button => button.dataset.external==='1'
            ? navigate('external-tasting',button.dataset.bottlingId,{flightId:state.selected})
            : navigate('tasting',button.dataset.bottlingId,{tastingId:button.dataset.tastingId,flightId:state.selected}),
        'tasting-flight-new-owned': () => {
            const id=document.querySelector('[data-flight-owned-bottling]')?.value;
            if (id && state.collection.bottlings.some(b=>b.id===id)) navigate('tasting',id,{tastingId:'new',flightId:state.selected});
        },
        'tasting-flight-new-external': () => navigate('external-tasting','new',{flightId:state.selected}),
        'tastings-back-detail': () => navigate('detail',state.selected),
        'tastings-back-home': () => navigate('tastings-home'),
        'tastings-back-list': () => navigate('tastings',state.selected),
        'tastings-open': button => button.dataset.tastingId
            ? navigate('tasting',state.selected,{tastingId:button.dataset.tastingId})
            : navigate('tastings',state.selected),
        'tastings-new': () => navigate('tasting',state.selected,{tastingId:'new'}),
        'tastings-start-choice': () => tastingsView.toggleCreateChoice(),
        'tastings-start-owned': () => {
            const id=document.querySelector('[data-owned-tasting-bottling]')?.value;
            if (id && state.collection.bottlings.some(b=>b.id===id)) navigate('tasting',id,{tastingId:'new'});
        },
        'tastings-start-external': () => navigate('external-tasting','new'),
        'tastings-home-open': button => button.dataset.external==='1'
            ? navigate('external-tasting',button.dataset.bottlingId)
            : navigate('tasting',button.dataset.bottlingId,{tastingId:button.dataset.tastingId}),
        'tasting-create': () => tastingsView.saveDraft(),
        'tasting-edit-start': () => tastingsView.startEditing(),
        'tasting-edit-done': () => tastingsView.finishEditing(),
        'tasting-open-bottling': () => navigate('detail',state.selected),
        'tasting-external-edit': () => tastingsView.startExternalEdit(),
        'tasting-external-cancel': () => tastingsView.cancelExternalEdit(),
        'tasting-external-save': () => tastingsView.persistExternalDetails(),
        'tasting-external-assign': () => tastingsView.showAssignDialog(),
        'tasting-external-assign-confirm': () => tastingsView.assignExternalToBottling(),
        'tasting-delete': button => confirmInModal(t('tastings.delete'),t('tastings.deleteConfirm'),async()=>{
            const id=button.dataset.tastingId;
            const external=state.page==='external-tasting';
            const result = await action(()=>request(external?`/api/external-tastings/${encodeURIComponent(id)}`:`/api/bottlings/${encodeURIComponent(state.selected)}/tastings/${encodeURIComponent(id)}`,{method:'DELETE'}), {scope:'collection'});
            if (!result.ok) return result;
            navigate(external?'tastings-home':'tastings',external?null:state.selected,{replace:true});
            return result;
        },t('common.actions.delete')),
        'warehouse-shelf-copy': button => warehouseView.openForm('shelf-copy', button.dataset.id),
        'warehouse-shelf-delete': button => warehouseView.askDelete('shelf', button.dataset.id),
        'warehouse-assign': button => warehouseView.openForm('assign', button.dataset.id),
        'warehouse-bottles-assign-selected': () => warehouseView.assignSelectedBottles(),
        'warehouse-bottles-select-clear': () => warehouseView.clearBottleSelection(),
        'warehouse-bottles-select-all': () => warehouseView.selectAllBottles(),
        'warehouse-bottle-preview': button => warehouseView.openBottlePreview(button.dataset.id),
        'warehouse-bottle-select': button => warehouseView.toggleWallBottleSelection(button.dataset.id),
        'warehouse-bottles-preview-selected': () => warehouseView.previewSelectedBottle(),
        'warehouse-unassigned-prev': () => warehouseView.stepUnassignedWallPage(-1),
        'warehouse-unassigned-next': () => warehouseView.stepUnassignedWallPage(1),
        'warehouse-focus': button => {
            const place = state.warehouse?.rooms.find(r => r.furniture.some(f => f.shelves.some(s => s.id === button.dataset.id)));
            if (!place) return navigate('warehouse', 'find');
            state.warehouseRoomId=place.id;
            state.warehouseFurnitureId=place.furniture.find(f=>f.shelves.some(s=>s.id===button.dataset.id)).id;
            navigate('warehouse', 'shelves');
        },
        'warehouse-confirm-delete': () => warehouseView.deleteConfirmed(),
        'warehouse-confirm-delete-unassign': () => warehouseView.deleteConfirmed(true),
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
        'import-apply': () => externalImport.applyImport(),
        'import-continue': () => externalImport.confirmPendingImport(),
        'import-existing-bottle': () => editors.newBottle(true),
        'import-existing-photo': () => externalImport.attachToExistingBottle(),
        'import-existing-edit': () => externalImport.editExisting(),
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
        'modal-confirm-accept': () => modal.acceptConfirmation(),
        'modal-choice': button => modal.acceptChoice(button.dataset.choice),
        'add-distillery': () => settings.promptDistillery(),
        'rename-distillery': button => settings.promptDistillery(button.dataset.id),
        scan: () => scanner.scanCode(),
        'scan-into-bottle': () => scanner.scanCode(true),
        'submit-code': button => resolveCode(query('[name=manualCode]').value, button.dataset.assign === '1'),
        'confirm-action': async () => {
            const task = pendingConfirmation;
            if (!task || confirmationBusy) return;
            confirmationBusy = true;
            const confirmation = state.modal;
            try {
                const result = await task();
                if (result?.ok === false || result === false) return;
                pendingConfirmation = null;
                // A successful task may have navigated or closed this modal itself.
                if (state.modal === confirmation) modal.closeModal(true);
            } finally {
                confirmationBusy = false;
            }
        },
        'confirm-import': () => settings.confirmImport(),
        'delete-file': button => confirmInModal(t("ui.confirmations.deleteAttachment"), t("ui.confirmations.deleteAttachmentQuestion"), async () => {
            const result = await action(() => request(`/api/bottles/${encodeURIComponent(button.dataset.id)}/files/${encodeURIComponent(button.dataset.fileId)}`, { method: 'DELETE' }), {scope:'collection'});
            if (result.ok) toast(t("ui.confirmations.attachmentDeleted"));
            return result;
        }),
        'open-photo': button => photoViewer.open(button),
        'photo-editor-open': button => photoEditor.open(button),
        'photo-editor-tab': button => photoEditor.selectTab(button.dataset.photoEditorTab),
        'photo-editor-before': () => photoEditor.before(),
        'photo-editor-auto': () => photoEditor.auto(),
        'photo-editor-reset': () => photoEditor.reset(),
        'photo-editor-reset-group': button => photoEditor.resetGroup(button.dataset.photoGroup),
        'photo-editor-pick-white': () => photoEditor.toggleWhitePicker(),
        'photo-editor-brush-mode': button => photoEditor.toggleBrush(button.dataset.photoBrushMode),
        'photo-editor-brush-undo': () => photoEditor.undoBrush(),
        'photo-editor-zoom-in': () => photoEditor.zoom(1.5),
        'photo-editor-zoom-out': () => photoEditor.zoom(1/1.5),
        'photo-editor-zoom-reset': () => photoEditor.zoom(0),
        'photo-editor-save': () => photoEditor.save(),
        'photo-editor-cutout': () => photoEditor.cutout(),
        'photo-editor-toggle-cutout': () => photoEditor.toggleCutout(),
        'photo-editor-remove-cutout': () => photoEditor.removeCutout(),
        'photo-zoom-in': () => photoViewer.zoom(1.25),
        'photo-zoom-out': () => photoViewer.zoom(1/1.25),
        'photo-zoom-reset': () => photoViewer.zoom(0),
        'photo-prev': () => photoViewer.step(-1),
        'photo-next': () => photoViewer.step(1),
        'move-photo': button => movePhoto(button.dataset.id, button.dataset.photoId, Number(button.dataset.dir), action),
        'delete-photo': button => confirmInModal(t("ui.confirmations.deletePhoto"), t("ui.confirmations.deletePhotoQuestion"), async () => {
            const result = await action(() => request(`/api/bottles/${encodeURIComponent(button.dataset.id)}/photos/${encodeURIComponent(button.dataset.photoId)}`, { method: 'DELETE' }), {scope:'collection'});
            if (result.ok) toast(t("ui.confirmations.photoDeleted"));
            return result;
        }),
        'delete-bottle': button => confirmInModal(t("ui.confirmations.deleteBottle"), t("ui.confirmations.deleteBottleQuestion"), async () => {
            const result = await action(() => request(`/api/bottles/${encodeURIComponent(button.dataset.id)}`, { method: 'DELETE' }));
            if (result.ok) toast(t("ui.confirmations.bottleDeleted"));
            return result;
        }),
        'delete-bottling': () => confirmInModal(t("ui.confirmations.deleteBottling"), t("ui.confirmations.deleteBottlingQuestion"), async () => {
            const result = await action(() => request(`/api/bottlings/${encodeURIComponent(state.selected)}`, { method: 'DELETE' }));
            if (result.ok) {
                navigate('home', null, { replace: true });
                toast(t("ui.confirmations.bottlingDeleted"));
            }
            return result;
        }),
        import: () => settings.importJSON(),
    };
    bindFlightSorting(root, (from,to,after) => tastingsView.reorderFlightMember(from,to,after));
    root.addEventListener('click', async (event) => {
        const mapButton = event.target.closest?.('[data-map-focus], [data-map-page], [data-map-bottling], [data-map-edit]');
        if (state.page === 'map' && mapButton) { mapView.handleClick(mapButton); return; }
        const overviewButton = event.target.closest?.('[data-collection-mode], [data-page-to]');
        if (overviewButton && state.page === 'home') { home.handleClick(overviewButton); return; }
        const button = event.target.closest('[data-act]');
        if (!button || button.disabled) {
            return;
        }
        // Opening a whole wall compartment requires a double-click. Keep
        // the single click available for bottle selection and drag gestures.
        // Flaschen im Moebelmanager besitzen einen eigenen Einzel-Detail-Button;
        // nur Doppelklick auf die Fachflaeche oeffnet den Fachinhalt.
        if (button.dataset.act === 'warehouse-shelf-view' && button.classList?.contains('warehouse-wall-bay')) return;
        if (button.tagName === 'A') {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
        }
        try {
            if (button.dataset.act.startsWith('auth-')) { await auth.handleAction(button); return; }
            await handlers[button.dataset.act]?.(button);
        }
        catch (error) {
            toast(error.message, true);
        }
    });
    root.addEventListener('dblclick', event => {
        // A bottle in the room-wide rack opens its own details on double-click.
        // Single clicks still toggle bulk selection; the surrounding bay must
        // never interpret this as a compartment double-click.
        const bottle = event.target.closest?.('.warehouse-room-wall .warehouse-bottle-symbol[data-act="warehouse-bottle-select"]');
        if (bottle?.dataset?.id) {
            try { warehouseView.openBottlePreview(bottle.dataset.id); }
            catch (error) { toast(error.message, true); }
            return;
        }
        const shelf = event.target.closest?.('.warehouse-wall-bay[data-shelf-id], .warehouse-furniture-manager .warehouse-shelf[data-shelf-id]');
        if (!shelf || shelf.dataset?.capacity === '0') return;
        // A bottle is independently selectable and draggable. Double-clicks
        // on bottle symbols or explicit buttons must not also open the shelf.
        const action = event.target.closest?.('[data-act]');
        if (action && action !== shelf) return;
        if (event.target.closest?.('button, a, input, select, textarea')) return;
        try { warehouseView.openShelfDetails(shelf.dataset.shelfId); }
        catch (error) { toast(error.message, true); }
    });
    root.addEventListener('keydown', event => {
        if (event.target.matches?.('[data-whisky-picker-area]') && ['Enter',' '].includes(event.key)) {
            event.preventDefault();
            tastingsView?.commitCustomPreview?.();
            return;
        }
        if (tastingsView?.nudgeCustomColor?.(event)) return;
        if (!['Enter',' '].includes(event.key)) return;
        const bay=event.target.closest?.('.warehouse-wall-bay[data-act="warehouse-shelf-view"]');
        if (bay && bay.dataset?.capacity !== '0' && event.target === bay) {
            event.preventDefault();
            warehouseView.openShelfDetails(bay.dataset.shelfId);
        }
    });
    root.addEventListener('input', event => {
        handleFlavorRange(event);
        if (event.target.matches?.('[data-flavor-detail] [data-tasting-score]')) tastingsView.previewRating();
    });
    root.addEventListener('change', event => {
        if (event.target.matches?.('[data-flavor-detail] [data-flavor-range], [data-flavor-detail] [data-tasting-note], [data-flavor-detail] [data-tasting-score]')) tastingsView.commitFlavor();
        if (event.target.matches?.('[data-flavor-detail] [data-tasting-date], [data-flavor-detail] [data-tasting-title]')) void tastingsView.persistMeta();
    });
    let flavorPointer = null;
    let customColorPointer = null;
    root.addEventListener('pointerdown', event => {
        const picker=event.target?.closest?.('[data-whisky-picker-area]');
        if (picker) {
            customColorPointer=event.pointerId;
            picker.setPointerCapture?.(event.pointerId);
            tastingsView.previewCustomFromPointer(event);
            return;
        }
        const hit = event.target?.closest?.('[data-flavor-hit]');
        if (!hit) return;
        flavorPointer = event.pointerId; hit.setPointerCapture?.(event.pointerId); setFlavorFromPointer(event);
    });
    root.addEventListener('pointermove', event => {
        if (customColorPointer === event.pointerId) tastingsView.previewCustomFromPointer(event);
        if (flavorPointer === event.pointerId) setFlavorFromPointer(event);
    });
    root.addEventListener('pointerup', event => {
        if (customColorPointer === event.pointerId) {
            customColorPointer=null;
            tastingsView.previewCustomFromPointer(event);
            tastingsView?.commitCustomPreview?.();
            return;
        }
        if (flavorPointer === event.pointerId) { flavorPointer = null; if (event.target.closest?.('[data-flavor-detail]')) tastingsView.commitFlavor(); }
    });
    root.addEventListener('pointercancel', event => {
        if (customColorPointer === event.pointerId) { customColorPointer=null; tastingsView.resetCustomPreview(); }
        if (flavorPointer === event.pointerId) flavorPointer = null;
    });
    root.addEventListener('keyup', event => {
        if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key) && event.target.matches?.('[data-whisky-picker-area]'))
            tastingsView.commitCustomPreview();
    });
    root.addEventListener('submit', event => {
        if (auth.handleSubmit(event)) return;
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
        if (state.page === 'map' && event.target.matches?.('#map-site-select, #map-all-distilleries')) {
            mapView.handleChange(event.target); return;
        }
        if (state.page === 'home' && event.target.matches?.('#pagination-size, [id^=filter-]')) { home.handleChange(event.target); return; }
        if (event.target.matches?.('input[data-bottle-files], input[data-bottle-photos]')) {
            void detail.handleUploadChange(event); return;
        }
        if (event.target.matches?.('input[data-furniture-photos]')) {
            warehouseView.uploadFurniturePhotos(event.target.dataset.furniturePhotos,[...event.target.files]); return;
        }
        if (event.target.id === 'ui-language') { chooseLanguage(event.target.value); return; }
        if (event.target.dataset.sectionSwitch === 'analytics') {
            navigate('analytics', event.target.value);
            return;
        }
        if (event.target.dataset.sectionSwitch === 'warehouse') {
            navigate('warehouse', event.target.value);
            return;
        }
        if (event.target.dataset.sectionSwitch === 'settings') {
            if (activateSettingsSection(event.target.value,event.target.closest('.settings-page'))) state.settingsSection = event.target.value;
            return;
        }
        if (event.target.dataset.sectionSwitch === 'help') {
            activateHelpTopic(event.target.value, event.target.closest('.help-page'));
            return;
        }
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
        if (event.target.matches('.warehouse-bottle-check')) {warehouseView.toggleBottleSelection(event.target.dataset.id,event.target.checked);return;}
        if (event.target.id === 'warehouse-room-select') { warehouseView.selectRoom(event.target.value, state.selected === 'shelves' ? 'shelves' : 'rooms'); return; }
        if (event.target.id === 'warehouse-plan-layer') { state.warehousePlanLevel=event.target.value; render(); return; }
        if (event.target.id === 'warehouse-plan-zoom') { state.warehousePlanZoom = [100,150,200].includes(Number(event.target.value)) ? Number(event.target.value) : 100; warehouseView.update3DZoom(state.warehousePlanZoom); return; }
        if (event.target.name === 'warehouse-find-placement') {warehouseView.setFinderPlacement(event.target.value);return;}
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
        if (state.page === 'map' && event.target.matches?.('#map-bottling-search, #map-missing-search')) {
            mapView.handleInput(event.target); return;
        }
        if (state.page === 'home' && event.target.id === 'search') { home.handleInput(event.target); return; }
        if (event.target.id === 'warehouse-unassigned-wall-search') {warehouseView.setUnassignedWallSearch(event.target.value);return;}
        if (event.target.id === 'warehouse-search') {warehouseView.setFinderQuery(event.target.value);return;}
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
        // Sidebar buttons are native buttons: Tab and Enter/Space work without
        // special handling. ArrowUp/Down and Home/End offer fast navigation.
        if (event.target.matches?.('.section-nav-desktop .section-nav-item')) {
            const items = [...event.target.closest('.section-nav-desktop').querySelectorAll('.section-nav-item')];
            const current = items.indexOf(event.target);
            let next = current;
            if (event.key === 'ArrowDown') next = (current + 1) % items.length;
            else if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = items.length - 1;
            if (next !== current) {
                event.preventDefault();
                items[next].click();
                document.querySelector(`.section-nav-desktop .section-nav-item:nth-child(${next + 1})`)?.focus();
                return;
            }
        }
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
