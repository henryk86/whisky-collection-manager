import {createCollectionActions} from './events/collection-actions.js';
import {createBackupActions} from './events/backup-actions.js';
import {createAnalyticsActions} from './events/analytics-actions.js';
import {createImportActions} from './events/import-actions.js';
import {createWarehouseActions} from './events/warehouse-actions.js';
import {createTastingActions} from './events/tasting-actions.js';
import {createPhotoEditorActions} from './events/photo-editor-actions.js';
import {query, queryAll} from './ui/dom.js';
import {destructiveFooter} from './ui/modal-layout.js';
import {chooseLanguage, t} from './i18n/index.js';
import {request} from './api.js';
import {toast} from './ui/notifications.js';
import {movePhoto} from './features/photo-order.js';
import {bindFlightSorting} from './features/flight-order.js';
import {preserveManualComposition, suggestSingleDistilleryComposition} from './features/forms/composition.js';
import {routeUrl} from './navigation/routes.js';
import {readAnalyticsDate} from './domain/analytics-period.js';
import {saveCollectionViewPreference}
  from './domain/collection-view-preference.js';
import {activateHelpTopic} from './views/help.js';
import {activateSettingsSection} from './views/settings.js';
import {handleFlavorRange, setFlavorFromPointer} from './ui/flavor-profile.js';
import {loadTemplates} from './ui/templates.js';

const renderTemplate = await loadTemplates('dialogs/events.html');

/**
 * One delegated click handler; HTML data-act values are the UI action names.
 *
 * @param {!Element} root Root element or directory.
 * @param {!Object} options2 Destructured options for this operation.
 */
export function bindEvents(
  root,
  {
    state,
    render,
    action,
    navigate,
    editors,
    settings,
    backup,
    scanner,
    externalImport,
    modal,
    photoViewer,
    photoEditor,
    filePreview,
    theme,
    resolveCode,
    warehouseView,
    detail,
    tastingsView,
    home,
    mapView,
    auth
  }
) {
  /**
   * Requests the next inventory number and fills the named input if still mounted.
   *
   * @param {string} fieldName Name of the inventory-number input receiving the suggestion.
   * @return {!Promise<*>} Completion of the inventory-number request and field update.
   */
  const suggestNumber = async (fieldName) => {
    const result = await request('/api/suggest-number');
    const field = /** @type {HTMLInputElement} */ (query(`[name=${fieldName}]`));
    if (field) {
      field.value = result.number;
    }
  };
  let pendingConfirmation = null;
  let confirmationBusy = false;
  /**
   * Opens a destructive-action confirmation and stores the callback until confirmation.
   *
   * @param {*} title Title displayed or stored by this operation.
   * @param {*} message Message to display or use for diagnostics.
   * @param {*} task Task to execute or examine.
   * @param {string=} buttonLabel Text of the destructive confirmation button.
   */
  function confirmInModal(title, message, task, buttonLabel =
    'Endgültig löschen') {
    pendingConfirmation = task;
    modal.showModal(
      title,
      renderTemplate('confirmInModalP', {
        message: message,
        destructiveFooter: destructiveFooter({
          cancelLabel: t('common.actions.cancel'),
          acceptLabel: buttonLabel,
          acceptAction: 'confirm-action',
        }),
      })
    );
  }

  /**
   * Shows or hides the navigation drawer and moves focus to the appropriate control.
   *
   * @param {boolean} open Whether to display the navigation drawer and backdrop.
   */
  function setMenu(open) {
    const drawer = document.getElementById('site-drawer');
    const backdrop = /** @type {HTMLElement} */ (document.querySelector('.site-drawer-backdrop'));
    const button = document.getElementById('menu-button');
    if (!drawer || !backdrop || !button) return;
    drawer.hidden = !open;
    backdrop.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) /** @type {HTMLElement} */ (drawer.querySelector('[data-act="close-menu"]'))?.focus();
    else button.focus();
  }
  const handlers = {
    ...createCollectionActions({home, tastingsView}),
    ...createBackupActions({backup}),
    ...createAnalyticsActions({navigate, state, render}),
    ...createImportActions({externalImport, editors}),
    ...createWarehouseActions({warehouseView, state, navigate, render}),
    ...createTastingActions({tastingsView, warehouseView, state, navigate, confirmInModal, action}),
    ...createPhotoEditorActions({photoEditor}),
    /**
     * Handles the toggle menu interaction.
     * @return {*} No return value; toggles the navigation drawer.
     */
    'toggle-menu': () =>
      setMenu(document.getElementById('site-drawer')?.hidden !== false),
    /**
     * Handles the close menu interaction.
     * @return {*} No return value; hides the navigation drawer.
     */
    'close-menu': () => setMenu(false),
    /**
     * Navigates to the collection overview.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    'goto-home': () => navigate('home'),
    /**
     * Opens the global tasting and flight overview.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    'goto-tastings-home': () => navigate('tastings-home'),
    /**
     * Opens the map without a selected bottling.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    'goto-map': () => navigate('map'),
    /**
     * Opens the application help page.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    'goto-help': () => navigate('help'),
    /**
     * Handles the help tab interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {boolean} True if the requested help topic was activated.
     */
    'help-tab': button => activateHelpTopic(button.dataset.helpTopic, button.closest('.help-page')),
    /**
     * Opens the map for the currently selected bottling.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    'bottling-map': () => navigate('map', state.selected),
    /**
     * Opens the analytics overview.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    'goto-analysis': () => navigate('analytics', 'overview'),
    /**
     * Opens the storage overview.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    'goto-warehouse': () => navigate('warehouse', 'overview'),
    /**
     * Handles the settings section interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {!Promise<*>} Completion of settings-section navigation and any required data load.
     */
    'settings-section': async button => {
      if (activateSettingsSection(button.dataset.settingsSection, button.closest('.settings-page'))) {
        state.settingsSection = button.dataset.settingsSection;
        if (state.settingsSection === 'users') await auth.loadUsers();
      }
    },
    /**
     * Restores the preceding sensory-profile edit.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'flavor-detail-undo': () => tastingsView.undoFlavor(),
    /**
     * Reapplies the next sensory-profile edit.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'flavor-detail-redo': () => tastingsView.redoFlavor(),
    /**
     * Handles the goto settings menu interaction.
     * @return {!Promise<*>} Completion of opening the settings page and closing the navigation drawer.
     */
    'goto-settings-menu': async () => {
      navigate('settings');
      if (state.backupUnlocked) await backup.refresh(true);
    },
    /**
     * Starts the coordinate lookup for the edited distillery.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'find-distillery-location': () => settings.findDistilleryLocation(),
    /**
     * Applies the coordinates supplied by the selected search result.
     * @param {!HTMLElement} button Triggering action element passed to the controller.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'apply-distillery-location': button =>
      settings.applyDistilleryLocation(button),
    /**
     * Switches between the available light and dark themes.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'toggle-theme': () => theme.toggleTheme(),
    /**
     * Handles the suggest first interaction.
     * @return {!Promise<*>} Completion of filling the first-bottle inventory-number suggestion.
     */
    'suggest-first': () => suggestNumber('firstInventoryNumber'),
    /**
     * Handles the suggest bottle interaction.
     * @return {!Promise<*>} Completion of filling the physical-bottle inventory-number suggestion.
     */
    'suggest-bottle': () => suggestNumber('inventoryNumber'),
    /**
     * Opens the bottling creation choice.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    new: () => editors.newBottling(),
    /**
     * Opens the form for a new bottling directly.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'new-bottling-direct': () => editors.createBottling(),
    /**
     * Returns to the collection overview.
     * @return {void} Navigation is synchronous; no result is consumed.
     */
    back: () => navigate('home'),
    /**
     * Handles the open interaction.
     *
     * @param {*} button Button control involved in the interaction.
     */
    open: button => {
      const bottleId = button.dataset.bottleId || null;
      navigate('detail', button.dataset.id, {highlightBottleId: bottleId});
      // In bottle mode show the chosen physical bottle, not only its parent
      // bottling.
      if (bottleId) document.getElementById(`bottle-${bottleId}`)?.scrollIntoView({block: 'center', behavior: 'auto'});
    },
    /**
     * Handles the toggle view interaction.
     */
    'toggle-view': () => {
      state.view = state.view === 'cards' ? 'table' : 'cards';
      saveCollectionViewPreference(state.view);
      render();
    },
    /**
     * Opens the editor for the selected bottling.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'edit-bottling': () => editors.editBottling(),
    /**
     * Adds a physical bottle to the current bottling.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'add-bottle': () => editors.newBottle(),
    /**
     * Opens the editor for the physical bottle identified by the action.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'edit-bottle': button => editors.editBottle(button.dataset.id),
    /**
     * Closes the active modal.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'close-modal': () => modal.closeModal(),
    /**
     * Accepts the currently pending confirmation.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'modal-confirm-accept': () => modal.acceptConfirmation(),
    /**
     * Resolves the pending modal choice using the selected value.
     * @param {!HTMLElement} button Action element carrying data-choice.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'modal-choice': button => modal.acceptChoice(button.dataset.choice),
    /**
     * Opens the new-distillery dialog.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'add-distillery': () => settings.promptDistillery(),
    /**
     * Opens the rename dialog for the selected distillery.
     * @param {!HTMLElement} button Action element carrying data-id.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'rename-distillery': button => settings.promptDistillery(button.dataset.id),
    /**
     * Opens the barcode scanner for a lookup.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    scan: () => scanner.scanCode(),
    /**
     * Opens the scanner in inventory-number assignment mode.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'scan-into-bottle': () => scanner.scanCode(true),
    /**
     * Resolves the manually entered code using the action's assignment mode.
     * @param {!HTMLElement} button Action element carrying data-assign.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'submit-code': button => resolveCode(/** @type {HTMLInputElement} */(query('[name=manualCode]')).value, button.dataset.assign === '1'),
    /**
     * Handles the confirm action interaction.
     * @return {!Promise<*>} Completion of the pending confirmed action, if one exists.
     */
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
    /**
     * Confirms the pending collection import.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'confirm-import': () => settings.confirmImport(),
    /**
     * Handles the delete file interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} No return value; opens a file-deletion confirmation.
     */
    'delete-file': button => confirmInModal(
      t("ui.confirmations.deleteAttachment"),
      t("ui.confirmations.deleteAttachmentQuestion"),
      async () => {
        const result = await action(
          () => request(
            `/api/bottles/${encodeURIComponent(button.dataset.id)}/files/${encodeURIComponent(button.dataset.fileId)}`,
            {method: 'DELETE'}
          ),
          {scope: 'collection'}
        );
        if (result.ok) toast(t("ui.confirmations.attachmentDeleted"));
        return result;
      }
    ),
    /**
     * Updates the explicitly assigned purpose of an existing attachment.
     * @param {!HTMLElement} button Attachment designation control.
     * @return {Promise<*>} Mutation and collection refresh outcome.
     */
    'mark-purchase-evidence': button => action(() => request(
      `/api/bottles/${encodeURIComponent(button.dataset.id)}/files/${encodeURIComponent(button.dataset.fileId)}`,
      {method: 'PATCH', body: JSON.stringify({purchaseEvidence: button.dataset.evidence === 'true'})}
    ), {scope: 'collection'}),
    /**
     * Opens the file preview for the selected attachment.
     * @param {!HTMLElement} button Triggering action element passed to the controller.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'preview-file': button => filePreview.open(button),
    /**
     * Opens the selected photo in the lightbox.
     * @param {!HTMLElement} button Triggering action element passed to the controller.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'open-photo': button => photoViewer.open(button),
    /**
     * Increases the current lightbox zoom by a factor of 1.25.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'photo-zoom-in': () => photoViewer.zoom(1.25),
    /**
     * Decreases the current lightbox zoom by a factor of 1.25.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'photo-zoom-out': () => photoViewer.zoom(1 / 1.25),
    /**
     * Resets the lightbox zoom to its default.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'photo-zoom-reset': () => photoViewer.zoom(0),
    /**
     * Moves to the previous lightbox photo.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'photo-prev': () => photoViewer.step(-1),
    /**
     * Moves to the next lightbox photo.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    'photo-next': () => photoViewer.step(1),
    /**
     * Handles the move photo interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {!Promise<*>} Completion of the requested photo reordering operation.
     */
    'move-photo': button => movePhoto(button.dataset.id, button.dataset.photoId, Number(button.dataset.dir), action),
    /**
     * Handles the delete photo interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} No return value; opens a photo-deletion confirmation.
     */
    'delete-photo': button => confirmInModal(
      t("ui.confirmations.deletePhoto"),
      t("ui.confirmations.deletePhotoQuestion"),
      async () => {
        const result = await action(
          () => request(
            `/api/bottles/${encodeURIComponent(button.dataset.id)}/photos/${encodeURIComponent(button.dataset.photoId)}`,
            {method: 'DELETE'}
          ),
          {scope: 'collection'}
        );
        if (result.ok) toast(t("ui.confirmations.photoDeleted"));
        return result;
      }
    ),
    /**
     * Handles the delete bottle interaction.
     *
     * @param {*} button Button control involved in the interaction.
     * @return {*} No return value; opens a physical-bottle deletion confirmation.
     */
    'delete-bottle': button => confirmInModal(
      t("ui.confirmations.deleteBottle"),
      t("ui.confirmations.deleteBottleQuestion"),
      async () => {
        const result = await action(() => request(`/api/bottles/${encodeURIComponent(button.dataset.id)}`, {method: 'DELETE'}));
        if (result.ok) toast(t("ui.confirmations.bottleDeleted"));
        return result;
      }
    ),
    /**
     * Handles the delete bottling interaction.
     * @return {*} No return value; opens a bottling-deletion confirmation.
     */
    'delete-bottling': () => confirmInModal(
      t("ui.confirmations.deleteBottling"),
      t("ui.confirmations.deleteBottlingQuestion"),
      async () => {
        const result = await action(() => request(`/api/bottlings/${encodeURIComponent(state.selected)}`, {method: 'DELETE'}));
        if (result.ok) {
          navigate('home', null, {replace: true});
          toast(t("ui.confirmations.bottlingDeleted"));
        }
        return result;
      }
    ),
    /**
     * Starts the JSON import flow.
     * @return {*} Delegated completion or result; the event dispatcher does not consume the value.
     */
    import: () => settings.importJSON(),
  };
  bindFlightSorting(root, (from, to, after) => tastingsView.reorderFlightMember(from, to, after));
  root.addEventListener('click', async (/** @type {MouseEvent} */ event) => {
    const target = /** @type {Element} */ (event.target);
    // Treat the flavor and saved-view pickers like anchored menus: clicking
    // elsewhere closes them without affecting the document layout.
    for (const picker of /** @type {Iterable<HTMLDetailsElement>} */ (root.querySelectorAll('.collection-saved-menu[open], .collection-flavor-picker[open]'))) {
      if (!picker.contains(target)) picker.open = false;
    }
    const mapButton = target.closest?.('[data-map-focus], [data-map-page], [data-map-bottling], [data-map-edit]');
    if (state.page === 'map' && mapButton) {mapView.handleClick(mapButton); return;}
    const overviewButton = target.closest?.(
      '[data-collection-mode], [data-page-to], [data-act="toggle-collection-filters"], [data-act="collection-sort-column"], [data-act="collection-columns-default"], [data-reset-collection-filter], [data-reset-collection-flavor-axis]');
    if (overviewButton && state.page === 'home') {home.handleClick(overviewButton); return;}
    const button = /** @type {(HTMLElement|SVGElement) & {disabled?: boolean}} */ (target.closest('[data-act]'));
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
      if (button.dataset.act.startsWith('auth-')) {await auth.handleAction(button); return;}
      await handlers[button.dataset.act]?.(button);
    }
    catch (error) {
      toast(error.message, true);
    }
  });
  root.addEventListener('dblclick', event => {
    const target = /** @type {Element} */ (event.target);
    // A bottle in the room-wide rack opens its own details on double-click.
    // Single clicks still toggle bulk selection; the surrounding bay must
    // never interpret this as a compartment double-click.
    const bottle = /** @type {HTMLElement|SVGElement} */ (target.closest?.('.warehouse-room-wall .warehouse-bottle-symbol[data-act="warehouse-bottle-select"]'));
    if (bottle?.dataset?.id) {
      try {warehouseView.openBottlePreview(bottle.dataset.id);}
      catch (error) {toast(error.message, true);}
      return;
    }
    const shelf = /** @type {HTMLElement} */ (target.closest?.(
      '.warehouse-wall-bay[data-shelf-id], .warehouse-furniture-manager .warehouse-shelf[data-shelf-id]'));
    if (!shelf || shelf.dataset?.capacity === '0') return;
    // A bottle is independently selectable and draggable. Double-clicks
    // on bottle symbols or explicit buttons must not also open the shelf.
    const action = target.closest?.('[data-act]');
    if (action && action !== shelf) return;
    if (target.closest?.('button, a, input, select, textarea')) return;
    try {warehouseView.openShelfDetails(shelf.dataset.shelfId);}
    catch (error) {toast(error.message, true);}
  });
  root.addEventListener('keydown', (/** @type {KeyboardEvent} */ event) => {
    if (/** @type {Element} */ (event.target).matches?.('[data-whisky-picker-area]') && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      tastingsView?.commitCustomPreview?.();
      return;
    }
    if (tastingsView?.nudgeCustomColor?.(event)) return;
    if (!['Enter', ' '].includes(event.key)) return;
    const bay = /** @type {HTMLElement} */ (/** @type {Element} */ (event.target).closest?.('.warehouse-wall-bay[data-act="warehouse-shelf-view"]'));
    if (bay && bay.dataset?.capacity !== '0' && event.target === bay) {
      event.preventDefault();
      warehouseView.openShelfDetails(bay.dataset.shelfId);
    }
  });
  root.addEventListener('input', event => {
    handleFlavorRange(event);
    if (/** @type {Element} */ (event.target).matches?.('[data-flavor-detail] [data-tasting-score]'))
      tastingsView.previewRating();
  });
  root.addEventListener('change', event => {
    if (/** @type {Element} */ (event.target).matches?.(
      '[data-flavor-detail] [data-flavor-range], [data-flavor-detail] [data-tasting-note], [data-flavor-detail] [data-tasting-score], [data-flavor-detail] [data-tasting-rating-comment]')) tastingsView.commitFlavor();
    if (/** @type {Element} */ (event.target).matches?.('[data-flavor-detail] [data-tasting-date], [data-flavor-detail] [data-tasting-title]')) void tastingsView.persistMeta();
  });
  let flavorPointer = null;
  let customColorPointer = null;
  root.addEventListener('pointerdown', (/** @type {PointerEvent} */ event) => {
    const picker = /** @type {Element} */ (event.target)?.closest?.('[data-whisky-picker-area]');
    if (picker) {
      customColorPointer = event.pointerId;
      picker.setPointerCapture?.(event.pointerId);
      tastingsView.previewCustomFromPointer(event);
      return;
    }
    const hit = /** @type {Element} */ (event.target)?.closest?.('[data-flavor-hit]');
    if (!hit) return;
    flavorPointer = event.pointerId; hit.setPointerCapture?.(event.pointerId);
    setFlavorFromPointer(event);
  });
  root.addEventListener('pointermove', (/** @type {PointerEvent} */ event) => {
    if (customColorPointer === event.pointerId) tastingsView.previewCustomFromPointer(event);
    if (flavorPointer === event.pointerId) setFlavorFromPointer(event);
  });
  root.addEventListener('pointerup', (/** @type {PointerEvent} */ event) => {
    if (customColorPointer === event.pointerId) {
      customColorPointer = null;
      tastingsView.previewCustomFromPointer(event);
      tastingsView?.commitCustomPreview?.();
      return;
    }
    if (flavorPointer === event.pointerId) {
      flavorPointer = null; if (/** @type {Element} */ (event.target).closest?.('[data-flavor-detail]')) tastingsView.commitFlavor();
    }
  });
  root.addEventListener('pointercancel', (/** @type {PointerEvent} */ event) => {
    if (customColorPointer === event.pointerId) {
      customColorPointer = null; tastingsView.resetCustomPreview();
    }
    if (flavorPointer === event.pointerId) flavorPointer = null;
  });
  root.addEventListener('keyup', (/** @type {KeyboardEvent} */ event) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) && /** @type {Element} */ (event.target).matches?.('[data-whisky-picker-area]'))
      tastingsView.commitCustomPreview();
  });
  root.addEventListener('submit', event => {
    const target = /** @type {HTMLFormElement} */ (event.target);
    if (auth.handleSubmit(event)) return;
    if (target.id === 'new-bottle-choice-form') {
      event.preventDefault();
      try {
        editors.chooseExistingBottling(/** @type {HTMLFormElement & {elements: {bottlingId: HTMLSelectElement}}} */(target).elements.bottlingId.value);
      }
      catch (error) {toast(error.message, true);}
      return;
    }
    if (target.id === 'warehouse-form') {
      warehouseView.submit(event);
      return;
    } else if (target.id === 'backup-password-form') {
      backup.setPassword(event).catch(error => toast(error.message, true));
    } else if (target.id === 'backup-unlock-zip-form') {
      backup.unlockPrepared(event).catch(error => toast(error.message, true));
    } else if (target.id === 'backup-import-zip-form') {
      backup.uploadZip(event).catch(error => toast(error.message, true));
    } else if (target.id === 'backup-apply-zip-form') {
      backup.applyZip(event).catch(error => toast(error.message, true));
    } else if (target.id === 'backup-unlock-form') {
      backup.unlock(event).catch(error => toast(error.message, true));
    } else if (target.id === 'backup-profile-form') {
      backup.save(event).catch(error => toast(error.message, true));
    } else if (target.id === 'backup-restore-form') {
      backup.submitRestore(event).catch(error => toast(error.message, true));
    } else if (target.id === 'collection-settings-form') {
      settings.saveCollectionSettings(event).catch(error => toast(error.message, true));
    } else if (target.id === 'distillery-form') {
      settings.saveDistillery(event).catch(error => toast(error.message, true));
    } else {
      editors.handleForm(event).catch(error => toast(error.message, true));
    }
  });
  root.addEventListener('change', event => {
    const target = /** @type {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} */ (event.target);
    if (target.matches?.('#bottling-form select[name=compositionComplete]')) {
      if (target.form) preserveManualComposition(target.form);
      return;
    }
    if (target.matches?.('#bottling-form select[name=whiskyType], #bottling-form input[name=distilleryIds]')) {
      if (target.form) suggestSingleDistilleryComposition(target.form);
      return;
    }
    if (state.page === 'map' && target.matches?.('#map-site-select, #map-all-distilleries')) {
      mapView.handleChange(target); return;
    }
    if (state.page === 'home' && target.matches?.(
      '#pagination-size, [id^=filter-], [data-collection-column], #collection-add-flavor-axis, [data-flavor-profile-status], [data-flavor-axis]')) {home.handleChange(target); return;}
    if (target.matches?.('input[data-bottle-files], input[data-bottle-photos]')) {
      void detail.handleUploadChange(event); return;
    }
    if (target.matches?.('input[data-furniture-photos]')) {
      warehouseView.uploadFurniturePhotos(target.dataset.furniturePhotos, [.../** @type {HTMLInputElement} */ (target).files]); return;
    }
    if (target.matches?.([
      '[data-flight-plan-style]', '[data-flight-plan-count]',
      '[data-flight-plan-availability]', '[data-flight-plan-focus]',
      '[name="flight-plan-unfamiliar"]', '[data-flight-plan-cask-mode]',
      '[name^="flight-cask-"]', '[data-flight-plan-cask-phase]',
      '[data-flight-plan-age-mode]', '[data-flight-plan-age-min]',
      '[data-flight-plan-age-max]', '[name="flight-plan-strict"]',
    ].join(', '))) {
      tastingsView.invalidateFlightPlan(); return;
    }
    if (target.id === 'ui-language') {
      chooseLanguage(target.value); return;
    }
    if (target.dataset.sectionSwitch === 'analytics') {
      navigate('analytics', target.value);
      return;
    }
    if (target.dataset.sectionSwitch === 'warehouse') {
      navigate('warehouse', target.value);
      return;
    }
    if (target.dataset.sectionSwitch === 'settings') {
      if (activateSettingsSection(target.value, target.closest('.settings-page'))) state.settingsSection = target.value;
      return;
    }
    if (target.dataset.sectionSwitch === 'help') {
      activateHelpTopic(target.value, target.closest('.help-page'));
      return;
    }
    if (target.name === 'type' && /** @type {HTMLElement} */ (target.closest?.('#warehouse-form'))?.dataset.newFurniture === 'true') {
      const form = target.closest('#warehouse-form');
      const bottom = /** @type {HTMLInputElement} */ (form.querySelector('[name="elevation"]'));
      const height = /** @type {HTMLInputElement} */ (form.querySelector('[name="itemHeight"]'));
      if (bottom && height) {
        if (target.value === 'haengeregal' && Number(bottom.value) === 0 && Number(height.value) === 1.8) {
          bottom.value = '1.9'; height.value = '0.4';
        } else if (target.value !== 'haengeregal' && Number(bottom.value) === 1.9 && Number(height.value) === 0.4) {
          bottom.value = '0'; height.value = '1.8';
        }
      }
      return;
    }
    if (target.matches('.warehouse-bottle-check')) {
      warehouseView.toggleBottleSelection(target.dataset.id, /** @type {HTMLInputElement} */(target).checked); return;
    }
    if (target.id === 'warehouse-room-select') {
      warehouseView.selectRoom(target.value, state.selected === 'shelves' ? 'shelves' : 'rooms'); return;
    }
    if (target.id === 'warehouse-plan-layer') {
      state.warehousePlanLevel = target.value; render(); return;
    }
    if (target.id === 'warehouse-plan-zoom') {
      state.warehousePlanZoom = [100, 150, 200].includes(Number(target.value)) ? Number(target.value) : 100; warehouseView.update3DZoom(state.warehousePlanZoom);
      return;
    }
    if (target.name === 'warehouse-find-placement') {
      warehouseView.setFinderPlacement(target.value); return;
    }
    const filter = target.dataset.analyticsFilter;
    if (filter && ['distillery', 'country', 'volumeType', 'status'].includes(filter)) {
      state.analyticsFilters[filter] = target.value;
      history.replaceState({whiskyRoute: true}, '', routeUrl('analytics', state.selected, state.analyticsFilters));
      render();
      return;
    }
    if (target.id === 'analytics-period') {
      state.analyticsPeriod = target.value === 'year' ? 'year' : 'month'; render(); return;
    }
    if (target.dataset.analyticsBoundary) {
      const boundary = target.dataset.analyticsBoundary;
      if (boundary === 'start' || boundary === 'end') {
        const key = boundary === 'start' ? 'analyticsStartDate' : 'analyticsEndDate';
        state[key] = readAnalyticsDate(target.value);
        render();
        return;
      }
    }
    if (target.matches('#backup-profile-form [name=provider]')) backup.toggleFields(target.form);
    if (target.id === 'scan-file') {
      scanner.scanImage(/** @type {HTMLInputElement} */(target).files?.[0]);
    }
  });
  root.addEventListener('input', event => {
    const target = /** @type {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} */ (event.target);
    if (state.page === 'map' && target.matches?.('#map-bottling-search, #map-missing-search')) {
      mapView.handleInput(target); return;
    }
    if (state.page === 'home' && target.id === 'search') {home.handleInput(target); return;}
    if (target.id === 'warehouse-unassigned-wall-search') {
      warehouseView.setUnassignedWallSearch(target.value); return;
    }
    if (target.id === 'warehouse-search') {
      warehouseView.setFinderQuery(target.value); return;
    }
    if (target.id === 'bottling-choice-search') {
      editors.filterExistingBottlings(target.value);
    }
    if (target.id === 'distillery-search') {
      state.distillerySearch = target.value;
      const term = state.distillerySearch.trim().toLocaleLowerCase('de');
      const list = query('.distillery-list');
      if (!list) return;
      let count = 0;
      const rows = queryAll('.distillery-row', list);
      for (const row of /** @type {Iterable<HTMLElement>} */ (rows)) {
        const match = row.querySelector('strong').textContent.toLocaleLowerCase('de').includes(term);
        row.hidden = !match;
        if (match) count++;
      }
      const counter = query('#distillery-count');
      if (counter) counter.textContent = `${count} von ${rows.length}`;
      const empty = /** @type {HTMLElement} */ (query('.distillery-no-results', list));
      if (empty) empty.hidden = count > 0;
      list.scrollTop = 0;
    }
    if (target.matches('.distillery-filter')) {
      const term = target.value.trim().toLocaleLowerCase('de');
      const panel = target.parentElement;
      queryAll('.distillery-option', panel).forEach((/** @type {HTMLElement} */ label) => {
        const checked = label.querySelector('input').checked;
        label.hidden = !checked && !label.textContent.toLocaleLowerCase('de').includes(term);
      });
    }
  });
  document.addEventListener('keydown', event => {
    const target = /** @type {Element} */ (event.target);
    // Sidebar buttons are native buttons: Tab and Enter/Space work without
    // special handling. ArrowUp/Down and Home/End offer fast navigation.
    if (target.matches?.('.section-nav-desktop .section-nav-item')) {
      const items = [...target.closest('.section-nav-desktop').querySelectorAll('.section-nav-item')];
      const current = items.indexOf(target);
      let next = current;
      if (event.key === 'ArrowDown') next = (current + 1) % items.length;
      else if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = items.length - 1;
      if (next !== current) {
        event.preventDefault();
        /** @type {HTMLElement} */ (items[next]).click();
        /** @type {HTMLElement} */ (document.querySelector(`.section-nav-desktop .section-nav-item:nth-child(${next + 1})`))?.focus();
        return;
      }
    }
    if (event.key === 'Escape' && state.page === 'home' && !state.modal) {
      const openPicker = /** @type {HTMLDetailsElement} */ (document.querySelector('.collection-flavor-picker[open], .collection-saved-menu[open]'));
      if (openPicker) {
        openPicker.open = false; openPicker.querySelector('summary')?.focus(); return;
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
    if (['Enter', ' '].includes(event.key) && target.matches('.whisky-card, .brand, tr.clickable[data-act], .warehouse-iso-object')
    ) {
      event.preventDefault();
      /** @type {HTMLElement} */ (target).click();
    }
  });
}
