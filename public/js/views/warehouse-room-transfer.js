import {actionButton} from '../ui/buttons.js';
/**
 * A compact, two-mode room transfer dialog. The server owns validation and
 * persistence.
 */
import {t} from '../i18n/index.js';
import {escapeHtml as esc} from '../ui/dom.js';

const FORM_EXPORT = 'warehouse-room-export-form';
const FORM_IMPORT = 'warehouse-room-import-form';

/**
 * Renders the warehouse-room transfer interface.
 *
 * @param {*} rooms Rooms used by this operation.
 * @param {*} selectedRoomId Selected room id used by this operation.
 * @param {string=} initialMode Initial mode used by this operation.
 * @return {string} Resulting text.
 */
export function roomTransferMarkup(rooms, selectedRoomId, initialMode = 'export') {
  const exportAvailable = rooms.length > 0;
  const mode = exportAvailable && initialMode !== 'import' ? 'export' :
    'import';
  /**
   * Produces the tab text used by the caller.
   *
   * @param {*} name Environment variable or setting name.
   * @param {*} label Label shown to the user.
   * @return {string} Resulting text.
   */
  const tab = (name, label) =>
    `<button type="button" class="btn warehouse-transfer-tab${mode ===
      name ? ' active' :
      ''}" role="tab" id="warehouse-transfer-tab-${name}" aria-selected="${mode === name}" aria-controls="warehouse-transfer-panel-${name}" tabindex="${mode === name ? 0 : -1}" data-transfer-tab="${name}" ${name === 'export' && !exportAvailable ? 'disabled' : ''}>${label}</button>`;
  const actions = `${actionButton({
    label: t('common.actions.cancel'),
    action: 'close-modal',
  })}`;
  return `<div id="warehouse-room-transfer" class="warehouse-room-transfer">
        <div class="warehouse-transfer-tabs" role="tablist" aria-label="${t('warehouse.transfer.action')}">
            ${tab('export', t('warehouse.transfer.exportAction'))}
            ${tab('import', t('warehouse.transfer.importAction'))}
        </div>
        <section class="warehouse-transfer-panel" id="warehouse-transfer-panel-export" role="tabpanel" aria-labelledby="warehouse-transfer-tab-export" ${mode !== 'export' ? 'hidden' : ''}>
            <form id="${FORM_EXPORT}" class="warehouse-transfer-form">
                <p>${t('warehouse.transfer.exportDescription')}</p>
                <label class="warehouse-transfer-choice"><input type="checkbox" id="warehouse-transfer-all" ${selectedRoomId ? '' : 'checked'}> ${t('warehouse.transfer.allRooms')}</label>
                <div class="warehouse-transfer-rooms">${rooms.map(room =>
    `<label class="warehouse-transfer-choice"><input class="warehouse-transfer-room" type="checkbox" value="${esc(room.id)}" ${selectedRoomId === room.id ? 'checked' : ''}> ${esc(room.name)} (${room.furniture.length})</label>`).join('')}</div>
                <label class="warehouse-transfer-choice"><input type="checkbox" id="warehouse-transfer-assignments"> ${t('warehouse.transfer.includeAssignments')}</label>
                <p class="hint">${t('warehouse.transfer.exportNote')}</p>
                <div class="actions ds-modal-footer warehouse-form-actions">${actions}<button type="submit" class="btn primary">${t('warehouse.transfer.download')}</button></div>
            </form>
        </section>
        <section class="warehouse-transfer-panel" id="warehouse-transfer-panel-import" role="tabpanel" aria-labelledby="warehouse-transfer-tab-import" ${mode !== 'import' ? 'hidden' : ''}>
            <form id="${FORM_IMPORT}" class="warehouse-transfer-form">
                <p>${t('warehouse.transfer.importDescription')}</p>
                <label class="form-field">${t('warehouse.transfer.file')}<input type="file" id="warehouse-transfer-file" accept=".json,application/json" required></label>
                <label class="warehouse-transfer-choice"><input type="checkbox" id="warehouse-transfer-import-assignments" checked> ${t('warehouse.transfer.includeAssignments')}</label>
                <label class="form-field">${t('warehouse.transfer.conflicts')}<select id="warehouse-transfer-conflict-policy"><option value="skip">${t('warehouse.transfer.skipConflicts')}</option><option value="replace">${t('warehouse.transfer.replaceConflicts')}</option></select></label>
                <p class="hint">${t('warehouse.transfer.importWarning')}</p>
                <div id="warehouse-transfer-preview" aria-live="polite"></div>
                <div class="actions ds-modal-footer warehouse-form-actions">${actions}<button type="submit" class="btn primary">${t('warehouse.transfer.preview')}</button><button type="button" class="btn primary" id="warehouse-transfer-apply" disabled>${t('warehouse.transfer.confirm')}</button></div>
            </form>
        </section>
    </div>`;
}

/**
 * Creates warehouse room transfer for warehouse room transfer.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!Object} Structured result for the caller.
 */
export function createWarehouseRoomTransfer({modal, request, getWarehouse, refresh, toast}) {
  /**
   * Controls transfer for warehouse room transfer.
   *
   * @param {*} selectedRoomId Selected room id used by this operation.
   */
  function openTransfer(selectedRoomId) {
    const rooms = getWarehouse()?.rooms || [];
    modal.showModal(
      t('warehouse.transfer.title'),
      roomTransferMarkup(rooms, selectedRoomId),
      true
    );
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
      for (const tab of tabs) {
        const active = tab.dataset.transferTab === next;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        host.querySelector(`#warehouse-transfer-panel-${tab.dataset
          .transferTab}`).hidden = !active;
      }
    };
    tabs.forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.transferTab));
      tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End']
          .includes(event.key)) return;
        event.preventDefault();
        const names = rooms.length ? ['export', 'import'] : ['import'];
        const index = names.indexOf(tab.dataset.transferTab);
        const next = event.key === 'Home' ? names[0] : event.key === 'End' ?
          names.at(-1) : names[(index + (event.key === 'ArrowRight' ? 1 :
            -1) + names.length) % names.length];
        switchTab(next);
        host.querySelector(`[data-transfer-tab="${next}"]`)?.focus();
      });
    });
    const all = exportForm.querySelector('#warehouse-transfer-all');
    const choices = [...exportForm.querySelectorAll('.warehouse-transfer-room')];
    /**
     * Updates choices in the current state.
          * @return {*} Result of this expression.
*/
    const updateChoices = () => choices.forEach(input => {
      input.disabled =
        all.checked; input.checked = all.checked || input.checked;
    });
    all.addEventListener('change', updateChoices);
    updateChoices();
    exportForm.addEventListener('submit', async event => {
      event.preventDefault(); event.stopPropagation();
      const ids = all.checked ? 'all' : choices.filter(input =>
        input.checked).map(input => input.value);
      if (Array.isArray(ids) &&
        !ids.length) return toast(t('warehouse.transfer.selectRoom'), true);
      const submit = exportForm.querySelector('[type="submit"]'); submit.disabled = true;
      try {
        const bundle = await request(
          '/api/warehouse/rooms/export',
          {
            method: 'POST',
            body: JSON.stringify({
              roomIds: ids,
              includeAssignments: exportForm.querySelector('#warehouse-transfer-assignments').checked,
            }),
          }
        );
        const bytes = new Blob(
          [JSON.stringify(bundle, null, 2) + '\n'],
          {type: 'application/json'}
        );
        const url = URL.createObjectURL(bytes);
        try {
          const link = document.createElement('a'); link.href =
            url; link.download = `wcm-rooms-${new Date().toISOString()
              .slice(0, 10)}.json`;
          document.body.appendChild(link); link.click(); link.remove();
        } finally {setTimeout(() => URL.revokeObjectURL(url), 1000);}
        modal.closeModal();
      } catch (error) {toast(error.message, true);} finally {submit.disabled = false;}
    });
    const preview = importForm.querySelector('#warehouse-transfer-preview');
    const apply = importForm.querySelector('#warehouse-transfer-apply');
    /**
     * Updates the invalidate state for its caller.
     */
    const invalidate = () => {apply.disabled = true; preview.textContent = '';};
    importForm.querySelector('#warehouse-transfer-file')
      .addEventListener('change',
        () => {importedFile = null; invalidate();}
      );
    importForm.querySelector('#warehouse-transfer-import-assignments')
      .addEventListener('change',
        invalidate
      );
    importForm.querySelector('#warehouse-transfer-conflict-policy')
      .addEventListener('change',
        invalidate
      );
    /**
     * Locates the DOM elements used by options.
     * @return {!Object} Matching DOM element, if present.
     */
    const options = () => ({
      includeAssignments: importForm.querySelector('#warehouse-transfer-import-assignments').checked,
      conflictPolicy: importForm.querySelector('#warehouse-transfer-conflict-policy').value,
    });
    importForm.addEventListener('submit', async event => {
      event.preventDefault(); event.stopPropagation(); invalidate();
      const file = importForm.querySelector('#warehouse-transfer-file')
        .files[0];
      if (!file) return toast(t('warehouse.transfer.selectFile'), true);
      if (file.size > 12 * 1024 *
        1024) return toast(t('warehouse.transfer.tooLarge'), true);
      const submit = importForm.querySelector('[type="submit"]'); submit.disabled = true;
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
        preview.innerHTML =
          `<div class="panel warehouse-transfer-summary"><strong>${t('warehouse.transfer.previewTitle')}</strong><dl>${entries.map(([field, label]) => `<div><dt>${t(label)}</dt><dd>${summary[field] ?? 0}</dd></div>`).join('')}</dl>${summary.blockedRooms ? `<p class="hint">${t('warehouse.transfer.blockedWarning')}</p>` : ''}</div>`;
        apply.disabled = !!summary.blockedRooms || (!summary.createdRooms &&
          !summary.replacedRooms);
      } catch (error) {
        importedFile = null; toast(
          error instanceof SyntaxError ?
            t('warehouse.transfer.invalidJson') : error.message,
          true
        );
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
