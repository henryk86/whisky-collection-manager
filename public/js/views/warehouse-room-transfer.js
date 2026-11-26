import {composeMarkup} from '../ui/render-plan.js';
import {replaceContent} from '../ui/dom-renderer.js';
import {actionButton} from '../ui/buttons.js';
/**
 * A compact, two-mode room transfer dialog. The server owns validation and
 * persistence.
 */
import {t} from '../i18n/index.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates('warehouse/warehouse-room-transfer.html');


const FORM_EXPORT = 'warehouse-room-export-form';
const FORM_IMPORT = 'warehouse-room-import-form';

/**
 * Renders the warehouse-room transfer interface.
 *
 * @param {*} rooms Warehouse rooms offered for export.
 * @param {*} selectedRoomId Identifier of the initially selected room for export.
 * @param {string=} initialMode Requested initial tab, export or import; falls back to import if there are no rooms.
 * @return {!import('../ui/render-plan.js').RenderPlan} Room import and export dialog with the appropriate initial tab.
 */
export function roomTransferMarkup(rooms, selectedRoomId, initialMode =
  'export') {
  const exportAvailable = rooms.length > 0;
  const mode = exportAvailable && initialMode !== 'import' ? 'export' : 'import';
  /**
   * Prepares room-transfer tab with selection and panel association.
   *
   * @param {*} name Environment variable or setting name.
   * @param {*} label Label shown to the user.
   * @return {!import('../ui/render-plan.js').RenderPlan} Room-transfer tab with selection and panel association.
   */
  const tab = (name, label) =>
    renderTemplate('warehouseTransferTabButton', {
      mode: mode === name ? ' active' : '',
      name: name,
      ariaSelected: mode === name,
      ariaControls: name,
      tabindex: mode === name ? 0 : -1,
      transferTab: name,
      exportAttributes: name === 'export' && !exportAvailable ? {"disabled": true} : {},
      label: label,
    });
  const actions = actionButton({
    label: t('common.actions.cancel'),
    action: 'close-modal',
  });
  return renderTemplate('warehouseRoomTransfer', {
    tab: tab('export', t('warehouse.transfer.exportAction')),
    importTab: tab('import', t('warehouse.transfer.importAction')),
    exportAttributes: mode !== 'export' ? {"hidden": true} : {},
    exportFormId: FORM_EXPORT,
    checkedAttributes: selectedRoomId ? {} : {"checked": true},
    rooms: composeMarkup(rooms.map(room =>
      renderTemplate('warehouseTransferChoice', {
        id: room.id,
        checkedAttributes: selectedRoomId === room.id ? {"checked": true} : {},
        name: room.name,
        length: room.furniture.length,
      }))),
    actions: actions,
    importAttributes: mode !== 'import' ? {"hidden": true} : {},
    importFormId: FORM_IMPORT,
    footerActions: actions,
  });
}

/**
 * Creates the room import and export controller with validation-preview and apply workflows.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!Object} Room transfer dialog and event-handling operations.
 */
export function createWarehouseRoomTransfer({modal, request, getWarehouse,
  refresh, toast}) {
  /**
   * Controls transfer for warehouse room transfer.
   *
   * @param {*} selectedRoomId Identifier of the room initially selected in the transfer dialog.
   */
  function openTransfer(selectedRoomId) {
    const rooms = getWarehouse()?.rooms || [];
    modal.showModal(t('warehouse.transfer.title'), roomTransferMarkup(rooms, selectedRoomId), true);
    const host = document.getElementById('warehouse-room-transfer');
    if (!host) return;
    const exportForm = host.querySelector(`#${FORM_EXPORT}`);
    const importForm = host.querySelector(`#${FORM_IMPORT}`);
    let importedFile = null;
    const tabs = [...host.querySelectorAll('[data-transfer-tab]')];
    /**
     * Updates the DOM elements managed by switch tab.
     *
     * @param {*} next Next candidate state or entry.
     */
    const switchTab = next => {
      if (next === 'export' && !rooms.length) return;
      for (const tab of /** @type {Iterable<HTMLElement>} */ (tabs)) {
        const active = tab.dataset.transferTab === next;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        /** @type {HTMLElement} */ (host.querySelector(`#warehouse-transfer-panel-${tab.dataset.transferTab}`)).hidden = !active;
      }
    };
    tabs.forEach((/** @type {HTMLElement} */ tab) => {
      tab.addEventListener('click', () => switchTab(tab.dataset.transferTab));
      tab.addEventListener('keydown', (/** @type {KeyboardEvent} */ event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const names = rooms.length ? ['export', 'import'] : ['import'];
        const index = names.indexOf(tab.dataset.transferTab);
        const next = event.key === 'Home' ? names[0] : event.key === 'End' ?
          names.at(-1) : names[(index + (event.key === 'ArrowRight' ? 1 : -1) + names.length) % names.length];
        switchTab(next);
        /** @type {HTMLElement} */ (host.querySelector(`[data-transfer-tab="${next}"]`))?.focus();
      });
    });
    const all = /** @type {HTMLInputElement} */ (exportForm.querySelector('#warehouse-transfer-all'));
    const choices = [...exportForm.querySelectorAll('.warehouse-transfer-room'),];
    /**
     * Disables individual room choices and selects them all when all-rooms export is enabled.
     * @return {*} No return value; synchronizes individual export checkboxes.
     */
    const updateChoices = () => choices.forEach((/** @type {HTMLInputElement} */ input) => {
      input.disabled = all.checked; input.checked = all.checked || input.checked;
    });
    all.addEventListener('change', updateChoices);
    updateChoices();
    exportForm.addEventListener('submit', async event => {
      event.preventDefault(); event.stopPropagation();
      const ids = all.checked ? 'all' : choices.filter((/** @type {HTMLInputElement} */ input) => input.checked).map((/** @type {HTMLInputElement} */ input) => input.value);
      if (Array.isArray(ids) && !ids.length) return toast(t('warehouse.transfer.selectRoom'), true);
      const submit = /** @type {HTMLButtonElement} */ (exportForm.querySelector('[type="submit"]'));
      submit.disabled = true;
      try {
        const bundle = await request(
          '/api/warehouse/rooms/export',
          {
            method: 'POST',
            body: JSON.stringify({
              roomIds: ids,
              includeAssignments: /** @type {HTMLInputElement} */ (exportForm.querySelector('#warehouse-transfer-assignments')).checked,
            }),
          }
        );
        const bytes = new Blob([JSON.stringify(bundle, null, 2) + '\n'], {type: 'application/json'});
        const url = URL.createObjectURL(bytes);
        try {
          const link = document.createElement('a'); link.href = url; link.download = `wcm-rooms-${new Date().toISOString().slice(0, 10)}.json`;
          document.body.appendChild(link); link.click(); link.remove();
        } finally {setTimeout(() => URL.revokeObjectURL(url), 1000);}
        modal.closeModal();
      } catch (error) {toast(error.message, true);} finally {
        submit.disabled = false;
      }
    });
    const preview = importForm.querySelector('#warehouse-transfer-preview');
    const apply = /** @type {HTMLButtonElement} */ (importForm.querySelector('#warehouse-transfer-apply'));
    /**
     * Invalidates the import preview and disables apply until validation is repeated.
     */
    const invalidate = () => {apply.disabled = true; preview.textContent = '';};
    importForm.querySelector('#warehouse-transfer-file').addEventListener('change',
      () => {importedFile = null; invalidate();}
    );
    importForm.querySelector('#warehouse-transfer-import-assignments').addEventListener('change', invalidate);
    importForm.querySelector('#warehouse-transfer-conflict-policy').addEventListener('change', invalidate);
    /**
     * Reads assignment-import and conflict-resolution choices from the transfer form.
     * @return {!Object} Matching DOM element, if present.
     */
    const options = () => ({
      includeAssignments: /** @type {HTMLInputElement} */ (importForm.querySelector('#warehouse-transfer-import-assignments')).checked,
      conflictPolicy: /** @type {HTMLSelectElement} */ (importForm.querySelector('#warehouse-transfer-conflict-policy')).value,
    });
    importForm.addEventListener('submit', async event => {
      event.preventDefault(); event.stopPropagation(); invalidate();
      const file = /** @type {HTMLInputElement} */ (importForm.querySelector('#warehouse-transfer-file')).files[0];
      if (!file) return toast(t('warehouse.transfer.selectFile'), true);
      if (file.size > 12 * 1024 * 1024) return toast(t('warehouse.transfer.tooLarge'), true);
      const submit = /** @type {HTMLButtonElement} */ (importForm.querySelector('[type="submit"]'));
      submit.disabled = true;
      try {
        importedFile = JSON.parse(await file.text());
        const summary = await request(
          '/api/warehouse/rooms/import/preview',
          {
            method: 'POST',
            body: JSON.stringify({document: importedFile, ...options()}),
          }
        );
        const entries = [
          ['roomsInFile', 'warehouse.transfer.sourceRooms'],
          ['createdRooms', 'warehouse.transfer.created'],
          ['replacedRooms', 'warehouse.transfer.replaced'],
          ['skippedRooms', 'warehouse.transfer.skipped'],
          ['blockedRooms', 'warehouse.transfer.blocked'],
          ['assigned', 'warehouse.transfer.assigned'],
          ['unmatched', 'warehouse.transfer.unmatched'],
          ['ambiguous', 'warehouse.transfer.ambiguous'],
          ['alreadyAssigned', 'warehouse.transfer.alreadyAssigned'],
          ['capacityExceeded', 'warehouse.transfer.capacityExceeded'],
        ];
        replaceContent(preview, renderTemplate('panel', {
          entries: composeMarkup(entries.map(([
            field, label]) => renderTemplate('openTransferDiv', {
              t: t(label),
              summary: summary[field] ?? 0,
            }))),
          hint: summary.blockedRooms ? renderTemplate('hint') : '',
        }));
        apply.disabled = !!summary.blockedRooms || (!summary.createdRooms && !summary.replacedRooms);
      } catch (error) {
        importedFile = null; toast(error instanceof SyntaxError ? t('warehouse.transfer.invalidJson') : error.message, true);
      } finally {submit.disabled = false;}
    });
    apply.addEventListener('click', async () => {
      if (!importedFile || apply.disabled) return;
      apply.disabled = true;
      try {
        const result = await request(
          '/api/warehouse/rooms/import',
          {
            method: 'POST',
            body: JSON.stringify({document: importedFile, ...options()}),
          }
        );
        modal.closeModal(); await refresh();
        toast(t(
          'warehouse.transfer.importSuccess',
          {
            rooms: result.createdRooms + result.replacedRooms,
            bottles: result.assigned,
          }
        ));
      } catch (error) {toast(error.message, true); apply.disabled = false;}
    });
  }
  return {openTransfer};
}
