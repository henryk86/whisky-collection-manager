

import {destructiveFooter} from '../ui/modal-layout.js';
import {t, tHtml} from '../i18n/index.js';

import {toast} from '../ui/notifications.js';

import {request} from '../api.js';

import {safe, count} from './warehouse-presentation.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates('warehouse/warehouse.html');

/**
 * Owns pending warehouse deletions and their confirmation lifecycle.
 * @param {!Object} options Controller dependencies.
 * @return {!Object} Public controller actions and presentation.
 */
export function createWarehouseDeleteController({currentRoom, selectedFurniture, modal, w, state, refresh}) {
  let pendingDelete = null;

  /**
   * Transforms the entries used by ask bulk delete.
      * @return {*} Result of this expression.
*/
  function askBulkDelete() {
    const room = currentRoom();
    const ids = selectedFurniture(room);
    if (!ids.length) return toast(t("warehouse.selection.noFurniture"), true);
    pendingDelete = {ids};
    modal.showModal(
      t("warehouse.bulk.deleteTitle", {count: ids.length}),
      renderTemplate('askBulkDeleteP', {
        deleteConfirmation: t("warehouse.bulk.deleteConfirmation", {count: ids.length}),
        ids: ids.map(id => room.furniture.find(f => f.id === id)?.name).map(safe).join(', '),
        destructiveFooter: destructiveFooter({
          cancelLabel: t("common.actions.cancel"),
          acceptLabel: t("warehouse.bulk.deleteAction", {count: ids.length}),
          acceptAction: 'warehouse-confirm-delete',
          className: 'warehouse-form-actions',
        }),
      })
    );
  }

  /**
   * Selects and transforms the ask delete records.
   *
   * @param {*} kind Value used by this operation.
   * @param {*} id Identifier of the affected record.
   */
  function askDelete(kind, id) {
    const endpoints = {
      room: `/api/warehouse/rooms/${id}`,
      furniture: `/api/warehouse/furniture/${id}`,
      shelf: `/api/warehouse/shelves/${id}`,
    };
    pendingDelete = endpoints[kind];
    if (kind === 'room') {
      const room = w().rooms.find(entry => entry.id === id);
      if (!room) return;
      const shelfIds = new Set(room.furniture.flatMap(furniture => furniture.shelves.map(shelf => shelf.id)));
      const occupied = Object.values(w().assignments || {}).filter(shelfId => shelfIds.has(shelfId)).length;
      if (occupied) {
        modal.showModal(
          t('warehouse.rooms.deleteOccupiedTitle'),
          renderTemplate('askDeleteP', {
            deleteOccupiedMessage: tHtml('warehouse.rooms.deleteOccupiedMessage', {name: room.name, count: occupied}),
            destructiveFooter: destructiveFooter({
              cancelLabel: t('common.actions.cancel'),
              acceptLabel: t('warehouse.rooms.unassignAndDelete'),
              acceptAction: 'warehouse-confirm-delete-unassign',
              className: 'warehouse-form-actions',
            }),
          })
        );
        return;
      }
      modal.showModal(
        t('warehouse.rooms.delete'),
        renderTemplate('askDeleteP2', {
          deleteEmptyMessage: tHtml('warehouse.rooms.deleteEmptyMessage', {name: room.name}),
          destructiveFooter: destructiveFooter({
            cancelLabel: t('common.actions.cancel'),
            acceptLabel: t('common.actions.remove'),
            acceptAction: 'warehouse-confirm-delete',
            className: 'warehouse-form-actions',
          }),
        })
      );
      return;
    }
    modal.showModal(
      t("warehouse.bottles.removeStorageLocation"),
      renderTemplate('askDeleteP3', {
        destructiveFooter: destructiveFooter({
          cancelLabel: t("common.actions.cancel"),
          acceptLabel: t("common.actions.remove"),
          acceptAction: 'warehouse-confirm-delete',
          className: 'warehouse-form-actions',
        }),
      })
    );
  }

  /**
   * Clears confirmed for warehouse.
   *
   * @param {boolean=} unassignBottles Unassign bottles used by this operation.
   */
  async function deleteConfirmed(unassignBottles = false) {
    if (!pendingDelete) return;
    const target = pendingDelete;
    const bulk = typeof target === 'object';
    const endpoint = unassignBottles && !bulk && target.startsWith('/api/warehouse/rooms/') ? `${target}?unassignBottles=true` : target;
    try {
      await request(
        bulk ? '/api/warehouse/furniture/bulk/delete' : endpoint,
        {
          method: bulk ? 'POST' : 'DELETE',
          ...(bulk ? {body: JSON.stringify(target)} : {}),
        }
      );
      pendingDelete = null;
      modal.closeModal(); state.warehouseFurnitureId = null;
      if (bulk) state.warehouseSelectedFurnitureIds = [];
      await refresh(); toast(bulk ?
        t("warehouse.bulk.deletedSuccess", {count: target.ids.length}) :
        t("warehouse.bottles.storageLocationRemoved"));
    } catch (err) {toast(err.message, true);}
  }

  return {askBulkDelete, askDelete, deleteConfirmed};
}
