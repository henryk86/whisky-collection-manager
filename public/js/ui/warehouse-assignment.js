import {composeMarkup} from './render-plan.js';
import {replaceContent} from './dom-renderer.js';
/**
 * Guided room -> furniture -> shelf assignment. The API still receives only
 * shelfId.
 */
import {t} from '../i18n/index.js';
import {escapeHtml} from './dom.js';
import {imageUrl} from './format.js';
import {bottleLabel, count, storagePath}
  from '../views/warehouse-presentation.js';
import {loadTemplates} from './templates.js';

const renderTemplate = await loadTemplates(new URL('./templates/warehouse-assignment.html', import.meta.url));


/**
 * Derives the safe result from the supplied values.
 *
 * @param {*} value Value to process.
 * @return {string} Resulting text.
 */
const safe = value => escapeHtml(String(value ?? ''));

/**
 * Resolves the current shelf location of a physical bottle.
 *
 * @param {!Object} warehouse Warehouse model being processed.
 * @param {*} shelfId Shelf id used by this operation.
 * @return {?Object} Value returned by the delegated operation.
 */
export function assignmentLocation(warehouse, shelfId) {
  return storagePath(warehouse, shelfId);
}

/**
 * Required total capacity after moving all selected bottles to this shelf.
 * Live bottles only: stale assignment references must not consume space.
 *
 * @param {!Object} warehouse Warehouse model being processed.
 * @param {*} shelf Shelf used by this operation.
 * @param {*} bottleIds Bottle ids used by this operation.
 * @return {?Object} Computed value, or null when the input has no match.
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
 * @param {*} shelf Shelf used by this operation.
 * @param {string} bottleId Identifier of the physical bottle.
 * @return {!Object} Structured result for the caller.
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
 * @param {*} shelfId Shelf id used by this operation.
 * @param {*} bottleIds Bottle ids used by this operation.
 * @param {*} confirmAction Confirm action used by this operation.
 * @return {!Promise<?Object>} Promise fulfilled when the operation completes.
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
 * Produces the option text used by the caller.
 *
 * @param {*} value Value to process.
 * @param {*} label Label shown to the user.
 * @param {!Object=} options Options controlling the operation.
 * @return {string} Resulting text.
 */
function option(value, label, {selected = false, disabled = false} = {}) {
  return renderTemplate('option', {
    safe: safe(value),
    selected: selected ? ' selected' : '',
    disabled: disabled ? ' disabled' : '',
    safe2: safe(label),
  });
}

/**
 * Transforms the entries used by room options.
 *
 * @param {*} warehouse Value used by this operation.
 * @param {*} selected Currently selected item or identifier.
 * @return {string} Resulting text.
 */
function roomOptions(warehouse, selected) {
  return composeMarkup(
    option('', t('warehouse.assignment.chooseRoom')),
    composeMarkup((warehouse.rooms || []).map(room => option(room.id, room.name, {selected: room.id === selected})))
  );
}

/**
 * Transforms the entries used by furniture options.
 *
 * @param {*} room Warehouse room being inspected or modified.
 * @param {*} selected Currently selected item or identifier.
 * @return {string} Resulting text.
 */
function furnitureOptions(room, selected) {
  return composeMarkup(
    option('', t('warehouse.assignment.chooseFurniture')),
    composeMarkup((room?.furniture || []).map(furniture => option(furniture.id, furniture.name, {selected: furniture.id === selected})))
  );
}

/**
 * Transforms the entries used by shelf options.
 *
 * @param {*} warehouse Value used by this operation.
 * @param {*} furniture Warehouse furniture record being modified.
 * @param {*} bottleId Value used by this operation.
 * @param {*} selected Currently selected item or identifier.
 * @return {string} Resulting text.
 */
function shelfOptions(warehouse, furniture, bottleId, selected) {
  return composeMarkup(
    option('', t('warehouse.assignment.chooseShelf')),
    composeMarkup((furniture?.shelves || []).map(shelf => {
      const info = assignmentShelfInfo(warehouse, shelf, bottleId);
      const detail = shelf.capacity === null
        ? t('warehouse.assignment.occupiedUnlimited', {count: info.occupied})
        : t('warehouse.assignment.occupiedLimited', {count: info.occupied, capacity: shelf.capacity});
      return option(shelf.id, `${shelf.name} · ${detail}`, {selected: shelf.id === selected, disabled: shelf.capacity === 0});
    }))
  );
}

/**
 * Builds the localized occupancy message text for the current language.
 *
 * @param {*} warehouse Value used by this operation.
 * @param {*} shelfId Value used by this operation.
 * @param {*} bottleId Value used by this operation.
 * @return {*} Value returned by the delegated operation.
 */
function occupancyMessage(warehouse, shelfId, bottleId) {
  const place = assignmentLocation(warehouse, shelfId);
  if (!place) return t('warehouse.assignment.selectHint');
  const info = assignmentShelfInfo(warehouse, place.shelf, bottleId);
  return place.shelf.capacity === null
    ? t('warehouse.assignment.occupiedUnlimited', {count: info.occupied})
    : t('warehouse.assignment.occupiedLimited', {count: info.occupied, capacity: place.shelf.capacity});
}

/**
 * The same destination controls work for a single bottle and a checked group.
 *
 * @param {!Object} warehouse Warehouse model being processed.
 * @param {!Object} bottle Physical bottle record being processed.
 * @return {string} Resulting text.
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
  const photo = isBulk ? '' : bottle.photoPath ? renderTemplate('img', {safe: safe(imageUrl(bottle.photoPath)), }) : renderTemplate('photoSvg');
  return renderTemplate('warehouseAssignment', {
    safe: safe(t('warehouse.assignment.bottleLabel')),
    photo: photo,
    isBulk: isBulk ? safe(t('warehouse.bottles.bulkSelected', {count: bottles.length})) : safe(bottleLabel(bottle)),
    warehouseAssignmentBulkList: isBulk ? renderTemplate(
      'warehouseAssignmentBulkList',
      {
        safe: safe(bottles.slice(0, 5).map(bottleLabel).join(' · ')),
        length: bottles.length > 5 ? ' …' : '',
      }
    ) : '',
    isBulk2: isBulk ? '' :
      renderTemplate('warehouseAssignmentCurrent', {
        safe: safe(t('warehouse.assignment.currentLocation')),
        safe2: safe(t('warehouse.assignment.currentLocation')),
        safe3: safe(current?.label || t('warehouse.bottles.unassignedLabel')),
      }),
    safe2: safe(t('warehouse.assignment.newLocation')),
    safe3: safe(t('warehouse.assignment.modeLabel')),
    safe4: safe(t('warehouse.assignment.room')),
    roomOptions: roomOptions(warehouse, roomId),
    safe5: safe(t('warehouse.assignment.furniture')),
    disabled: !roomId ? 'disabled' : '',
    furnitureOptions: furnitureOptions(current?.room, furnitureId),
    safe6: safe(t('warehouse.assignment.shelf')),
    disabled2: !furnitureId ? 'disabled' : '',
    shelfOptions: shelfOptions(warehouse, current?.furniture, ids, shelfId),
    safe7: safe(shelfId ? occupancyMessage(warehouse, shelfId, ids) : t('warehouse.assignment.selectHint')),
  });
}

/**
 * Mount only on the assignment dialog; unrelated warehouse forms are
 * untouched.
 *
 * @param {*} form Form used by this operation.
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
   * Derives the selected room result from the supplied values.
   * @return {*} Result computed from the supplied inputs.
   */
  const selectedRoom = () => (warehouse.rooms || []).find(entry => entry.id === room.value);

  /**
   * Derives the selected furniture result from the supplied values.
   * @return {*} Result computed from the supplied inputs.
   */
  const selectedFurniture = () => selectedRoom()?.furniture.find(entry => entry.id === furniture.value);

  /**
   * Locates the DOM elements used by mode.
   * @return {*} Matching DOM element, if present.
   */
  const mode = () => form.querySelector('[name="warehouseAssignmentMode"]:checked')?.value || 'shelf';

  /**
   * Updates feedback in the current state.
   */
  const updateFeedback = () => {
    const id = mode() === 'none' ? null : shelf.value;
    const place = id ? assignmentLocation(warehouse, id) : null;
    if (!place) {
      feedback.textContent = t(mode() === 'none' ? 'warehouse.assignment.withoutLocationHint' : 'warehouse.assignment.selectHint');
      return;
    }
    const need = shelfCapacityIncrease(warehouse, place.shelf, bottleId);
    feedback.textContent = need && !need.blocked
      ? `${occupancyMessage(warehouse, id, bottleId)} · ${t('warehouse.assignment.increaseCapacityNotice', {required: need.required})}`
      : occupancyMessage(warehouse, id, bottleId);
  };

  /**
   * Updates mode in the current state.
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
      replaceContent(shelf, shelfOptions(warehouse, null, bottleId, ''));
    } else if (event.target === furniture) {
      replaceContent(shelf, shelfOptions(warehouse, selectedFurniture(), bottleId, ''));
    }
    updateMode();
  });
  updateMode();
}

/**
 * Builds a single-bottle shelf assignment request.
 *
 * @param {*} mode Requested display mode or configuration variant.
 * @param {*} shelfId Shelf id used by this operation.
 * @param {!Object} warehouse Warehouse model being processed.
 * @return {!Object} Structured result for the caller.
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
 * @param {*} shelfId Shelf id used by this operation.
 * @param {!Object} warehouse Warehouse model being processed.
 * @return {!Object} Structured result for the caller.
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
