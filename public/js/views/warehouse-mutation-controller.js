

import {t} from '../i18n/index.js';
import {toast} from '../ui/notifications.js';
import {request} from '../api.js';

import {assignmentPayload, bulkAssignmentPayload, approveShelfCapacityIncrease} from '../ui/warehouse-assignment.js';

import {count} from './warehouse-presentation.js';

/**
 * Handles storage changes, assignment approval, form submissions and shelf ordering.
 * @param {!Object} options Controller dependencies.
 * @return {!Object} Public controller actions and presentation.
 */
export function createWarehouseMutationController({w, modal, selectedFurniture, currentRoom, refresh, selectedBottleIds, state, refreshFurnitureModal, rememberWallScroll, render}) {
  /**
   * Builds the localized approve capacity increase text for the current
   * language.
   *
   * @param {*} ids Identifiers in their current order.
   * @param {*} shelfId Identifier of the destination shelf whose capacity may need to increase.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  const approveCapacityIncrease = (ids, shelfId) =>
    approveShelfCapacityIncrease(
      w(),
      shelfId,
      ids,
      message => modal.confirm(
        t('warehouse.assignment.increaseCapacityTitle'),
        message,
        t('warehouse.assignment.increaseCapacityAction')
      )
    );

  /**
   * Performs the submit lifecycle action.
   *
   * @param {!Event} event Event that triggered this operation.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function submit(event) {
    event.preventDefault();
    const form = event.target;
    if (form.dataset.bulk === 'true') {
      const changes = {};
      for (const key of ['rotation', 'elevation', 'itemHeight', 'width',
        'depth']) {
        const value = form.elements.namedItem(key)?.value;
        if (value !== undefined && value !== '') changes[key] = Number(value);
      }
      for (const key of ['doorLeaves', 'glassFrame']) {
        const value = form.elements.namedItem(key)?.value;
        if (value === 'default') changes[key] = null;
        else if (value !== undefined && value !== '') changes[key] = key === 'doorLeaves' ? Number(value) : value === 'true';
      }
      for (const key of ['leftSidePanel', 'rightSidePanel', 'backPanel']) {
        const value = form.elements.namedItem(key)?.value;
        if (value === 'true' || value === 'false') changes[key] = value === 'true';
      }
      if (!Object.keys(changes).length) return toast(t("warehouse.validation.atLeastOneField"), true);
      const ids = selectedFurniture(currentRoom());
      if (!ids.length) return toast(t("warehouse.selection.noFurniture"), true);
      try {
        const result = await request('/api/warehouse/furniture/bulk', {method: 'PATCH', body: JSON.stringify({ids, changes})});
        modal.closeModal();
        await refresh();
        toast(t("warehouse.bulk.editedSuccess", {count: result.count}));
      } catch (err) {toast(err.message, true);}
      return;
    }
    let data = Object.fromEntries(new FormData(form).entries());
    if (form.classList.contains('warehouse-assignment-form')) {
      try {
        const ids = form.dataset.bottleBulk === 'true' ? selectedBottleIds() :
          [decodeURIComponent(form.dataset.endpoint.split('/').at(-1))];
        data = form.dataset.bottleBulk === 'true'
          ? bulkAssignmentPayload(
            ids,
            data.warehouseAssignmentMode,
            form.querySelector('[data-assignment-shelf]')?.value,
            w()
          )
          : assignmentPayload(data.warehouseAssignmentMode, form.querySelector('[data-assignment-shelf]')?.value, w());
        const approval = await approveCapacityIncrease(ids, data.shelfId);
        if (approval === null) return; // User declined; keep the form and selections.
        Object.assign(data, approval);
      } catch (error) {toast(error.message, true); return;}
    }
    for (const key of [
      'width',
      'height',
      'depth',
      'x',
      'y',
      'rotation',
      'elevation',
      'itemHeight',
    ]) if (key in data) data[key] = Number(data[key]);
    if (form.dataset.newFurniture === 'true' ||
      ['leftSidePanel', 'rightSidePanel', 'backPanel'].some(key => form.elements.namedItem(key))) {
      for (const key of ['leftSidePanel', 'rightSidePanel', 'backPanel']) if (
        form.elements.namedItem(key)) data[key] = form.elements.namedItem(key).checked;
    }
    if (form.elements.namedItem('doorLeaves')) data.doorLeaves = data.doorLeaves === '' ? null : Number(data.doorLeaves);
    if (form.elements.namedItem('glassFrame')) data.glassFrame = data.glassFrame === '' ? null : data.glassFrame === 'true';
    if (form.querySelector('.warehouse-door-ranges')) {
      data.doorRanges = [...form.querySelectorAll('.warehouse-door-range')].map(row => ({
        from: Number(row.querySelector('.door-range-from').value),
        to: Number(row.querySelector('.door-range-to').value),
        front: row.querySelector('.door-range-front').value,
        doorLeaves: row.querySelector('.door-range-leaves').value === '' ? null : Number(row.querySelector('.door-range-leaves').value),
        glassFrame: row.querySelector('.door-range-frame').value === '' ?
          null : row.querySelector('.door-range-frame').value === 'true',
      }));
    }
    if ('capacity' in data) data.capacity = data.capacity === '' ? null : Number(data.capacity);
    if ('heightCm' in data) data.heightCm = data.heightCm === '' ? null : Number(data.heightCm);
    if ('front' in data) data.front = data.front || null;
    if ('shelfId' in data) data.shelfId = data.shelfId || null;
    if (form.querySelector('[name="withShelves"]')) data.withShelves = form.querySelector('[name="withShelves"]').checked;
    try {
      const result = await request(form.dataset.endpoint, {method: form.dataset.method, body: JSON.stringify(data)});
      if (form.dataset.newFurniture === 'true' && result?.id) {
        // Keep the current room-plan tab and select the newly placed unit.
        // Its shelf manager can then be opened from the plan without routing.
        state.warehouseFurnitureId = result.id;
      }
      if (form.dataset.endpoint.endsWith('/copy')) {
        const copiedFurniture = form.querySelector('[name="withShelves"]');
        if (copiedFurniture) {
          state.warehouseRoomId = data.roomId;
          state.warehouseFurnitureId = result.id;
        } else {
          for (const room of w().rooms) for (const furniture of room.furniture) if (furniture.id === data.furnitureId) {
            state.warehouseRoomId = room.id;
            state.warehouseFurnitureId = furniture.id;
          }
        }
      }
      modal.closeModal();
      if (form.dataset.bottleBulk === 'true') state.warehouseSelectedBottleIds = [];
      await refresh();
      refreshFurnitureModal(); // refresh a suspended furniture manager after shelf capacity edits
      toast(form.dataset.endpoint.endsWith('/copy') ?
        t("warehouse.furniture.copiedWithoutAssignments") :
        t("warehouse.storage.saved"));
      return true;
    }
    catch (err) {toast(err.message, true);}
  }

  /**
   * Serializes relocate bottle data to JSON.
   *
   * @param {string} bottleId Identifier of the physical bottle to move.
   * @param {*} shelfId Identifier of the destination shelf, or an empty value to remove the assignment.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function relocateBottle(bottleId, shelfId) {
    const ids = Array.isArray(bottleId) ? bottleId : [bottleId];
    let approval;
    try {approval = await approveCapacityIncrease(ids, shelfId);}
    catch (error) {toast(error.message, true); return;}
    if (approval === null) return; // Capacity stays unchanged when cancelled.
    // This action rebuilds the warehouse page after the API responds.
    // Remember the exact viewport before waiting for the server.
    rememberWallScroll();
    const previousPageY = typeof window !== 'undefined' && Number.isFinite(window.scrollY) ? window.scrollY : null;
    try {
      if (Array.isArray(bottleId) && bottleId.length > 1) {
        await request('/api/warehouse/bottles/bulk', {
          method: 'POST',
          body: JSON.stringify({
            ...bulkAssignmentPayload(bottleId, 'shelf', shelfId, w()),
            ...approval,
          }),
        });
        state.warehouseSelectedBottleIds = [];
      } else {
        const id = Array.isArray(bottleId) ? bottleId[0] : bottleId;
        await request(`/api/warehouse/bottles/${encodeURIComponent(id)}`, {
          method: 'PUT', body: JSON.stringify({shelfId, ...approval}),
        });
      }
      await refresh();
      if (previousPageY !== null && typeof window.scrollTo === 'function') {
        window.scrollTo({top: previousPageY, left: 0, behavior: 'instant'});
      }
      toast(t('warehouse.shelves.dragSuccess'));
    } catch (error) {
      toast(error.message, true);
      render();
    }
  }

  /**
   * Serializes move shelf data to JSON.
   *
   * @param {*} id Identifier of the affected record.
   * @param {*} direction Direction used for traversal or movement.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function moveShelf(id, direction) {
    try {
      await request(
        `/api/warehouse/shelves/${encodeURIComponent(id)}/move`,
        {method: 'PATCH', body: JSON.stringify({direction})}
      );
      await refresh();
    } catch (error) {toast(error.message, true);}
  }

  return {submit, relocateBottle, moveShelf};
}
