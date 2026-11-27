import {composeMarkup} from './render-plan.js';
import {replaceContent} from './dom-renderer.js';
/**
 * Guided room -> furniture -> shelf assignment. The API still receives only
 * shelfId.
 */
import {t} from '../i18n/index.js';
import {imageUrl} from './format.js';
import {bottleLabel, count, storagePath}
  from '../views/warehouse-presentation.js';
import {loadTemplates} from './templates.js';

const renderTemplate = await loadTemplates('warehouse/warehouse-assignment.html');

/**
 * Resolves the current shelf location of a physical bottle.
 *
 * @param {!Object} warehouse Warehouse model being processed.
 * @param {*} shelfId Identifier of the assigned shelf to resolve into a room and furniture path.
 * @return {?Object} Room, furniture and shelf location, or null when the shelf cannot be resolved.
 */
export function assignmentLocation(warehouse, shelfId) {
  return storagePath(warehouse, shelfId);
}

/**
 * Required total capacity after moving all selected bottles to this shelf.
 * Live bottles only: stale assignment references must not consume space.
 *
 * @param {!Object} warehouse Warehouse model being processed.
 * @param {*} shelf Destination shelf whose configured capacity is checked.
 * @param {*} bottleIds Identifiers of physical bottles to assign to that shelf.
 * @return {?Object} Required capacity increase and blocking status, or null if no increase is needed.
 */
export function shelfCapacityIncrease(warehouse, shelf, bottleIds) {
  if (!shelf || shelf.capacity === null || shelf.capacity === undefined) return null;
  const ids = Array.isArray(bottleIds) ? bottleIds : [bottleIds];
  const chosen = new Set(ids);
  const known = new Set((warehouse?.bottles || []).map(bottle => bottle.id));
  const others = Object.entries(warehouse?.assignments || {}).filter(([id, target]) =>
    target === shelf.id && known.has(id) && !chosen.has(id)).length;
  const required = others + chosen.size;
  return required > shelf.capacity ? {
    current: shelf.capacity,
    required,
    blocked: shelf.capacity === 0 || required > 10000,
  } : null;
}

/**
 * Looks up the destination shelf's capacity and location details.
 *
 * @param {!Object} warehouse Warehouse model being processed.
 * @param {*} shelf Shelf whose assignment count and capacity are displayed.
 * @param {string} bottleId Identifier of the physical bottle.
 * @return {!Object} Shelf occupancy and assignment availability for the proposed bottle placement.
 */
export function assignmentShelfInfo(warehouse, shelf, bottleId) {
  const ids = Array.isArray(bottleId) ? bottleId : [bottleId];
  const selected = new Set(ids);
  const occupied = count(warehouse, shelf.id);
  const alreadyHere = ids.filter(id => warehouse.assignments?.[id] === shelf.id).length;
  const freeNeeded = ids.length - alreadyHere;
  const full = shelf.capacity !== null && shelf.capacity !== undefined && occupied + freeNeeded > shelf.capacity;
  return {occupied, full, capacity: shelf.capacity};
}

/**
 * Confirmation is mandatory before raising a shelf's positive capacity. A
 * numeric ceiling in the request prevents a concurrent change from raising
 * capacity beyond the number explicitly accepted by the user.
 *
 * @param {!Object} warehouse Warehouse model being processed.
 * @param {*} shelfId Identifier of the destination shelf.
 * @param {*} bottleIds Bottle identifiers included in the proposed assignment.
 * @param {*} confirmAction Confirmation callback used when the requested assignment needs more capacity.
 * @return {!Promise<?Object>} Approved capacity information, or null if the user declines or the increase is blocked.
 */
export async function approveShelfCapacityIncrease(warehouse, shelfId,
  bottleIds, confirmAction) {
  if (!shelfId) return {};
  const shelf = assignmentLocation(warehouse, shelfId)?.shelf;
  const needed = shelfCapacityIncrease(warehouse, shelf, bottleIds);
  if (!needed) return {};
  if (needed.blocked) throw new Error(t('warehouse.shelves.dragFull'));
  if (typeof confirmAction !== 'function' ||
    !(await confirmAction(t('warehouse.assignment.increaseCapacityConfirm', needed)))) return null;
  return {increaseCapacityTo: needed.required};
}

/**
 * Prepares select option with explicit selected and disabled states.
 *
 * @param {*} value Value to process.
 * @param {*} label Label shown to the user.
 * @param {!Object=} options Options controlling the operation.
 * @return {!import('./render-plan.js').RenderPlan} Select option with explicit selected and disabled states.
 */
function option(value, label, {selected = false, disabled = false} = {}) {
  return renderTemplate('option', {
    value: String(value ?? ''),
    selectedAttributes: selected ? {"selected": true} : {},
    disabledAttributes: disabled ? {"disabled": true} : {},
    label: String(label ?? ''),
  });
}

/**
 * Prepares room choices beginning with the unselected placeholder.
 *
 * @param {*} warehouse Warehouse containing the rooms offered in the assignment selector.
 * @param {*} selected Currently selected item or identifier.
 * @return {import('./render-plan.js').RenderPlan|string} Room choices beginning with the unselected placeholder (or scalar/empty text when no plan is needed).
 */
function roomOptions(warehouse, selected) {
  return composeMarkup(
    option('', t('warehouse.assignment.chooseRoom')),
    composeMarkup((warehouse.rooms || []).map(room => option(room.id, room.name, {selected: room.id === selected})))
  );
}

/**
 * Prepares furniture choices in the selected room.
 *
 * @param {*} room Warehouse room being inspected or modified.
 * @param {*} selected Currently selected item or identifier.
 * @return {import('./render-plan.js').RenderPlan|string} Furniture choices in the selected room (or scalar/empty text when no plan is needed).
 */
function furnitureOptions(room, selected) {
  return composeMarkup(
    option('', t('warehouse.assignment.chooseFurniture')),
    composeMarkup((room?.furniture || []).map(furniture => option(furniture.id, furniture.name, {selected: furniture.id === selected})))
  );
}

/**
 * Prepares shelf choices including availability and capacity restrictions.
 *
 * @param {*} warehouse Warehouse containing rooms, furniture, shelves and assignments.
 * @param {*} furniture Warehouse furniture record being modified.
 * @param {*} selected Currently selected item or identifier.
 * @return {import('./render-plan.js').RenderPlan|string} Shelf choices including availability and capacity restrictions (or scalar/empty text when no plan is needed).
 */
function shelfOptions(warehouse, furniture, selected) {
  return composeMarkup(
    option('', t('warehouse.assignment.chooseShelf')),
    composeMarkup((furniture?.shelves || []).map(shelf => {
      const detail = occupancyMessage(warehouse, shelf);
      return option(shelf.id, `${shelf.name} · ${detail}`, {selected: shelf.id === selected, disabled: shelf.capacity === 0});
    }))
  );
}

/**
 * Formats the actual occupancy of a shelf, independent of the proposed move.
 *
 * @param {!Object} warehouse Warehouse containing current shelf assignments.
 * @param {!Object} shelf Shelf whose current occupancy is displayed.
 * @return {string} Localized occupancy with the configured capacity, if limited.
 */
function occupancyMessage(warehouse, shelf) {
  const occupied = count(warehouse, shelf.id);
  return shelf.capacity === null
    ? t('warehouse.assignment.occupiedUnlimited', {count: occupied})
    : t('warehouse.assignment.occupiedLimited', {count: occupied, capacity: shelf.capacity});
}

/**
 * Describes exceptional capacity requirements for a proposed move.
 *
 * @param {!Object} warehouse Warehouse containing current shelf assignments.
 * @param {?Object} shelf Proposed destination, or null when no shelf is selected.
 * @param {*} bottleIds Physical bottle identifier or identifiers being assigned.
 * @return {string} Capacity warning, or empty text for an ordinary assignment.
 */
function capacityWarning(warehouse, shelf, bottleIds) {
  const need = shelfCapacityIncrease(warehouse, shelf, bottleIds);
  if (!need) return '';
  return need.blocked ? t('warehouse.shelves.dragFull') :
    t('warehouse.assignment.increaseCapacityNotice', {required: need.required});
}

/**
 * The same destination controls work for a single bottle and a checked group.
 *
 * @param {!Object} warehouse Warehouse model being processed.
 * @param {!Object} bottle Physical bottle record being processed.
 * @return {!import('./render-plan.js').RenderPlan} Storage destination controls for a single bottle or a group.
 */
export function renderWarehouseAssignment(warehouse, bottle) {
  const isBulk = Array.isArray(bottle);
  const bottles = isBulk ? bottle : [bottle];
  const ids = bottles.map(item => item.id);
  const initialShelf = isBulk ? null : warehouse.assignments?.[bottle.id];
  const current = initialShelf ? assignmentLocation(warehouse, initialShelf) : null;
  const roomId = current?.room.id || '';
  const furnitureId = current?.furniture.id || '';
  const shelfId = current?.shelf.id || '';
  const photo = isBulk ? '' : bottle.photoPath ? renderTemplate('img', {src: String((imageUrl(bottle.photoPath)) ?? ''), }) : renderTemplate('photoSvg');
  return renderTemplate('warehouseAssignment', {
    ariaLabel: t('warehouse.assignment.bottleLabel'),
    photo: photo,
    isBulk: isBulk ? t('warehouse.bottles.bulkSelected', {count: bottles.length}) : String((bottleLabel(bottle)) ?? ''),
    warehouseAssignmentBulkList: isBulk ? renderTemplate(
      'warehouseAssignmentBulkList',
      {
        bottleNames: String((bottles.slice(0, 5).map(bottleLabel).join(' · ')) ?? ''),
        length: bottles.length > 5 ? ' …' : '',
      }
    ) : '',
    currentLocationPanel: isBulk ? '' :
      renderTemplate('warehouseAssignmentCurrent', {
        ariaLabel: t('warehouse.assignment.currentLocation'),
        currentLocationLabel: t('warehouse.assignment.currentLocation'),
        currentLocation: String((current?.label || t('warehouse.bottles.unassignedLabel')) ?? ''),
        occupancy: current ? renderTemplate('warehouseAssignmentOccupancy', {
          occupancy: occupancyMessage(warehouse, current.shelf),
        }) : '',
      }),
    newLocation: t('warehouse.assignment.newLocation'),
    modeLabel: t('warehouse.assignment.modeLabel'),
    roomLabel: t('warehouse.assignment.room'),
    roomOptions: roomOptions(warehouse, roomId),
    furnitureLabel: t('warehouse.assignment.furniture'),
    disabledAttributes: !roomId ? {"disabled": true} : {},
    furnitureOptions: furnitureOptions(current?.room, furnitureId),
    shelfLabel: t('warehouse.assignment.shelf'),
    shelfDisabled: !furnitureId ? {"disabled": true} : {},
    shelfOptions: shelfOptions(warehouse, current?.furniture, shelfId),
    feedback: capacityWarning(warehouse, current?.shelf ?? null, ids),
  });
}

/**
 * Mount only on the assignment dialog; unrelated warehouse forms are
 * untouched.
 *
 * @param {*} form Assignment form containing the cascading room, furniture and shelf selectors.
 * @param {!Object} warehouse Warehouse model being processed.
 * @param {string} bottleId Identifier of the physical bottle.
 */
export function mountWarehouseAssignment(form, warehouse, bottleId) {
  if (!form) return;
  const room = form.querySelector('[data-assignment-room]');
  const furniture = form.querySelector('[data-assignment-furniture]');
  const shelf = form.querySelector('[data-assignment-shelf]');
  const feedback = form.querySelector('.warehouse-assignment-feedback');
  const choices = form.querySelector('.warehouse-assignment-selectors');
  if (!room || !furniture || !shelf || !feedback || !choices) return;
  /**
   * Resolves the selected room from the current room control.
   * @return {*} Room referenced by the current selection, or undefined if none matches.
   */
  const selectedRoom = () => (warehouse.rooms || []).find(entry => entry.id === room.value);

  /**
   * Resolves the selected furniture from the current room and furniture controls.
   * @return {*} Furniture in the selected room, or undefined if none matches.
   */
  const selectedFurniture = () => selectedRoom()?.furniture.find(entry => entry.id === furniture.value);

  /**
   * Reads the assignment mode selected in the form.
   * @return {*} Matching DOM element, if present.
   */
  const mode = () => form.querySelector('[name="warehouseAssignmentMode"]:checked')?.value || 'shelf';

  /**
   * Shows a warning only when the proposed move exceeds the destination capacity.
   */
  const updateFeedback = () => {
    const id = mode() === 'none' ? null : shelf.value;
    const place = id ? assignmentLocation(warehouse, id) : null;
    feedback.textContent = capacityWarning(warehouse, place?.shelf ?? null, bottleId);
  };

  /**
   * Enables or disables location controls and their required flags according to the assignment mode.
   */
  const updateMode = () => {
    const off = mode() === 'none';
    choices.classList.toggle('is-disabled', off);
    room.disabled = off;
    furniture.disabled = off || !selectedRoom();
    shelf.disabled = off || !selectedFurniture();
    // A selected shelf is mandatory only when a real assignment is requested.
    shelf.required = !off;
    room.required = !off;
    furniture.required = !off;
    updateFeedback();
  };
  form.addEventListener('change', event => {
    if (event.target === room) {
      replaceContent(furniture, furnitureOptions(selectedRoom(), ''));
      replaceContent(shelf, shelfOptions(warehouse, null, ''));
    } else if (event.target === furniture) {
      replaceContent(shelf, shelfOptions(warehouse, selectedFurniture(), ''));
    }
    updateMode();
  });
  updateMode();
}

/**
 * Builds a single-bottle shelf assignment request.
 *
 * @param {*} mode Requested display mode or configuration variant.
 * @param {*} shelfId Selected destination shelf identifier, or an empty value when unassigning.
 * @param {!Object} warehouse Warehouse model being processed.
 * @return {!Object} Validated single-bottle assignment data for the chosen mode and destination.
 */
export function assignmentPayload(mode, shelfId, warehouse) {
  if (mode === 'none') return {shelfId: null};
  if (mode !== 'shelf' || !shelfId || !assignmentLocation(warehouse, shelfId)) {
    throw new Error(t('warehouse.assignment.selectRequired'));
  }
  return {shelfId};
}

/**
 * Builds a batch shelf-assignment request from selected bottles.
 *
 * @param {!Array<*>} ids Identifiers in their current order.
 * @param {*} mode Requested display mode or configuration variant.
 * @param {*} shelfId Selected destination shelf identifier, or an empty value when unassigning.
 * @param {!Object} warehouse Warehouse model being processed.
 * @return {!Object} Validated bulk-assignment data containing bottle IDs and the destination.
 */
export function bulkAssignmentPayload(ids, mode, shelfId, warehouse) {
  const valid = new Set((warehouse?.bottles || []).map(item => item.id));
  if (!Array.isArray(ids) || !ids.length || ids.length > 500 || new Set(ids).size !== ids.length || ids.some(id => !valid.has(id))) {
    throw new Error(t('warehouse.bottles.bulkNothingSelected'));
  }
  const payload = assignmentPayload(mode, shelfId, warehouse);
  if (payload.shelfId !== null) {
    const place = assignmentLocation(warehouse, payload.shelfId);
    const increase = shelfCapacityIncrease(warehouse, place.shelf, ids);
    if (increase?.blocked) throw new Error(t('warehouse.shelves.dragFull'));
  }
  return {...payload, ids};
}
