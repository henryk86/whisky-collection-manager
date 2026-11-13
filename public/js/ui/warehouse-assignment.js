/** Guided room -> furniture -> shelf assignment. The API still receives only shelfId. */
import { t } from '../i18n/index.js';
import { escapeHtml } from './dom.js';
import { imageUrl } from './format.js';
import { bottleLabel, count, storagePath } from '../views/warehouse-presentation.js';

const safe = value => escapeHtml(String(value ?? ''));

export function assignmentLocation(warehouse, shelfId) {
    return storagePath(warehouse, shelfId);
}

export function assignmentShelfInfo(warehouse, shelf, bottleId) {
    const occupied = count(warehouse, shelf.id);
    const alreadyHere = warehouse.assignments?.[bottleId] === shelf.id;
    const full = shelf.capacity !== null && occupied >= shelf.capacity && !alreadyHere;
    return { occupied, full, capacity: shelf.capacity };
}

function option(value, label, { selected = false, disabled = false } = {}) {
    return `<option value="${safe(value)}"${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}>${safe(label)}</option>`;
}
function roomOptions(warehouse, selected) {
    return option('',t('warehouse.assignment.chooseRoom'))
        + (warehouse.rooms || []).map(room => option(room.id, room.name, {selected:room.id === selected})).join('');
}
function furnitureOptions(room, selected) {
    return option('',t('warehouse.assignment.chooseFurniture'))
        + (room?.furniture || []).map(furniture => option(furniture.id,furniture.name,{selected:furniture.id===selected})).join('');
}
function shelfOptions(warehouse, furniture, bottleId, selected) {
    return option('',t('warehouse.assignment.chooseShelf'))
        + (furniture?.shelves || []).map(shelf => {
            const info = assignmentShelfInfo(warehouse,shelf,bottleId);
            const detail = shelf.capacity === null
                ? t('warehouse.assignment.occupiedUnlimited',{count:info.occupied})
                : t('warehouse.assignment.occupiedLimited',{count:info.occupied,capacity:shelf.capacity});
            return option(shelf.id,`${shelf.name} · ${detail}`,{selected:shelf.id===selected,disabled:info.full});
        }).join('');
}
function occupancyMessage(warehouse, shelfId, bottleId) {
    const place = assignmentLocation(warehouse,shelfId);
    if (!place) return t('warehouse.assignment.selectHint');
    const info = assignmentShelfInfo(warehouse,place.shelf,bottleId);
    return place.shelf.capacity === null
        ? t('warehouse.assignment.occupiedUnlimited',{count:info.occupied})
        : t('warehouse.assignment.occupiedLimited',{count:info.occupied,capacity:place.shelf.capacity});
}

export function renderWarehouseAssignment(warehouse, bottle) {
    const current = assignmentLocation(warehouse,warehouse.assignments?.[bottle.id]);
    const roomId = current?.room.id || '';
    const furnitureId = current?.furniture.id || '';
    const shelfId = current?.shelf.id || '';
    const photo = bottle.photoPath
        ? `<img src="${safe(imageUrl(bottle.photoPath))}" alt="" loading="lazy">`
        : `<svg viewBox="0 0 32 60" aria-hidden="true"><rect x="12" y="2" width="8" height="13" rx="2"/><path d="M12 15C9 20 5 23 5 30v22c0 4 3 6 7 6h8c4 0 7-2 7-6V30c0-7-4-10-7-15Z"/><rect x="8" y="34" width="16" height="15" rx="2"/></svg>`;
    return `<section class="warehouse-assignment" aria-label="${safe(t('warehouse.assignment.bottleLabel'))}">
      <div class="warehouse-assignment-bottle">
        <div class="warehouse-assignment-photo">${photo}</div>
        <div class="warehouse-assignment-bottle-details"><span class="warehouse-assignment-eyebrow">${t('warehouse.assignment.bottleLabel')}</span>
          <strong>${safe(bottleLabel(bottle))}</strong>
          <span class="warehouse-assignment-current"><span>${t('warehouse.assignment.currentLocation')}</span><span>${safe(current?.label || t('warehouse.bottles.unassignedLabel'))}</span></span>
        </div>
      </div>
      <fieldset class="warehouse-assignment-target"><legend>${t('warehouse.assignment.newLocation')}</legend>
        <div class="warehouse-assignment-modes" role="radiogroup" aria-label="${safe(t('warehouse.assignment.modeLabel'))}">
          <label><input type="radio" name="warehouseAssignmentMode" value="shelf" checked><span>${t('warehouse.assignment.selectCompartment')}</span></label>
          <label><input type="radio" name="warehouseAssignmentMode" value="none"><span>${t('warehouse.assignment.withoutLocation')}</span></label>
        </div>
        <div class="warehouse-assignment-selectors">
          <label class="form-field">${t('warehouse.assignment.room')}<select data-assignment-room aria-label="${safe(t('warehouse.assignment.room'))}" required>${roomOptions(warehouse,roomId)}</select></label>
          <label class="form-field">${t('warehouse.assignment.furniture')}<select data-assignment-furniture aria-label="${safe(t('warehouse.assignment.furniture'))}" required ${!roomId?'disabled':''}>${furnitureOptions(current?.room,furnitureId)}</select></label>
          <label class="form-field warehouse-assignment-shelf">${t('warehouse.assignment.shelf')}<select name="shelfId" data-assignment-shelf aria-label="${safe(t('warehouse.assignment.shelf'))}" required ${!furnitureId?'disabled':''}>${shelfOptions(warehouse,current?.furniture,bottle.id,shelfId)}</select></label>
        </div>
        <p class="warehouse-assignment-feedback" aria-live="polite">${safe(shelfId ? occupancyMessage(warehouse,shelfId,bottle.id) : t('warehouse.assignment.selectHint'))}</p>
      </fieldset>
    </section>`;
}

/** Mount only on the assignment dialog; unrelated warehouse forms are untouched. */
export function mountWarehouseAssignment(form, warehouse, bottleId) {
    if (!form) return;
    const room = form.querySelector('[data-assignment-room]');
    const furniture = form.querySelector('[data-assignment-furniture]');
    const shelf = form.querySelector('[data-assignment-shelf]');
    const feedback = form.querySelector('.warehouse-assignment-feedback');
    const choices = form.querySelector('.warehouse-assignment-selectors');
    if (!room || !furniture || !shelf || !feedback || !choices) return;
    const selectedRoom = () => (warehouse.rooms || []).find(entry => entry.id === room.value);
    const selectedFurniture = () => selectedRoom()?.furniture.find(entry => entry.id === furniture.value);
    const mode = () => form.querySelector('[name="warehouseAssignmentMode"]:checked')?.value || 'shelf';
    const updateFeedback = () => {
        const id = mode() === 'none' ? null : shelf.value;
        const place = id ? assignmentLocation(warehouse,id) : null;
        if (!place) {
            feedback.textContent = t(mode() === 'none' ? 'warehouse.assignment.withoutLocationHint' : 'warehouse.assignment.selectHint');
            return;
        }
        feedback.textContent = occupancyMessage(warehouse,id,bottleId);
    };
    const updateMode = () => {
        const off = mode() === 'none';
        choices.classList.toggle('is-disabled',off);
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
            furniture.innerHTML = furnitureOptions(selectedRoom(), '');
            shelf.innerHTML = shelfOptions(warehouse,null,bottleId,'');
        } else if (event.target === furniture) {
            shelf.innerHTML = shelfOptions(warehouse,selectedFurniture(),bottleId,'');
        }
        updateMode();
    });
    updateMode();
}

export function assignmentPayload(mode, shelfId, warehouse) {
    if (mode === 'none') return {shelfId:null};
    if (mode !== 'shelf' || !shelfId || !assignmentLocation(warehouse,shelfId)) {
        throw new Error(t('warehouse.assignment.selectRequired'));
    }
    return {shelfId};
}
