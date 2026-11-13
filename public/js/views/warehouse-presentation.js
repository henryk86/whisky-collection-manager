/** Warehouse presentation helpers: pure HTML/SVG fragments and display labels.
 * No API writes, navigation or modal state. The controller is in warehouse.js.
 */
import { escapeHtml as esc } from '../ui/dom.js';
import { imageUrl } from '../ui/format.js';
import { routeUrl } from '../navigation/routes.js';
import { t, formatNumber } from '../i18n/index.js';
import { shelfLevels, effectiveShelfFront, visibleShelfFront, doorRangeForIndex, furnitureHeight } from '../domain/warehouse-compartments.js';

// Stable semantic keys, explicitly mapped from persisted domain codes.
// Never construct a translation key from a translated display label.
const FURNITURE_TYPE_KEYS = Object.freeze({
    regal:'warehouse.furniture.types.shelf', vitrine:'warehouse.furniture.types.displayCabinet',
    schrank:'warehouse.furniture.types.cabinet', kommode:'warehouse.furniture.types.dresser',
    kiste:'warehouse.furniture.types.crate', haengeregal:'warehouse.furniture.types.wallShelf',
    sonstiges:'warehouse.furniture.types.other',
});
const FRONT_KEYS = Object.freeze({
    open:'warehouse.front.open', door:'warehouse.front.woodDoor',
    glass:'warehouse.front.glassDoor', drawer:'warehouse.front.drawer',
});
const CAMERA_KEYS = Object.freeze({
    nw:'warehouse.camera.northwest', ne:'warehouse.camera.northeast',
    se:'warehouse.camera.southeast', sw:'warehouse.camera.southwest',
});
const ROOM_SECTION_KEYS = Object.freeze({
    overview:'warehouse.navigation.overview', rooms:'warehouse.navigation.roomPlans',
    shelves:'warehouse.navigation.shelves', find:'warehouse.navigation.findBottles',
});
const TYPES = Object.keys(FURNITURE_TYPE_KEYS);
const typeChoices = () => TYPES.map(type => [type, t(FURNITURE_TYPE_KEYS[type])]);
const typeName = type => TYPES.includes(type) ? t(FURNITURE_TYPE_KEYS[type]) : type;
const num = value => formatNumber(Number(value),{maximumFractionDigits:2});
const capacityLabel = s => s.shelves===0 ? t('warehouse.capacity.noShelves') : s.unlimited===0 ? t('warehouse.capacity.defined',{count:s.defined}) : s.defined===0 ? t('warehouse.capacity.onlyUnlimited',{count:s.unlimited}) : t('warehouse.capacity.partialUnlimited',{count:s.unlimited,places:s.defined});
const safe = value => esc(String(value ?? ''));
const count = (w, shelfId) => Object.values(w.assignments).filter(id => id === shelfId).length;
export function storagePath(warehouse, shelfId) {
    for (const room of warehouse?.rooms || []) for (const furniture of room.furniture) for (const shelf of furniture.shelves) {
        if (shelf.id === shelfId) return { room, furniture, shelf, label: `${room.name} / ${furniture.name} / ${shelf.name}` };
    }
    return null;
}
function field(name, label, value = '', type = 'text', options = '') {
    return `<label class="form-field">${esc(label)}<input name="${name}" type="${type}" ${options} value="${safe(value)}" required></label>`;
}
function choices(name, label, options, chosen = '') {
    return `<label class="form-field">${esc(label)}<select name="${name}">${options.map(([id,title]) => `<option value="${safe(id)}" ${id === chosen ? 'selected' : ''}>${esc(title)}</option>`).join('')}</select></label>`;
}
function footer() { return `<div class="actions warehouse-form-actions"><button type="button" class="btn" data-act="close-modal">${t("common.actions.cancel")}</button><button type="submit" class="btn primary">${t("common.actions.save")}</button></div>`; }
function bottleLabel(b) { return `${b.number ? '#'+b.number+' · ' : ''}${b.name}${b.volumeType==='sample'?' · Sample':''}`; }
function bottleRow(w, bottle) {
    const place = storagePath(w, w.assignments[bottle.id]);
    return `<div class="warehouse-bottle-row" data-bottle-search="${safe((bottleLabel(bottle)+' '+(place?.label||'')).toLocaleLowerCase('de'))}"><div><strong>${safe(bottleLabel(bottle))}</strong><small>${place ? safe(place.label) : t("detail.fields.unassigned")}</small></div><button class="btn small" type="button" data-act="warehouse-assign" data-id="${safe(bottle.id)}">${place?t("warehouse.bottles.relocate"):t("warehouse.bottles.assignAction")}</button></div>`;
}
function roomOptions(w, roomId) { return w.rooms.find(room => room.id === roomId); }
function findFurniture(w, furnitureId) {
    for (const room of w.rooms) { const furniture = room.furniture.find(f => f.id === furnitureId); if (furniture) return {room,furniture}; }
    return null;
}
function roomDiagram(room, w, layer = 'all') {
    // SVG coordinates are metres scaled to the viewBox. Drawing remains useful without JavaScript drag.
    const vbW = 600, vbH = Math.max(220, Math.round(600 * room.height / room.width));
    const sx = vbW / room.width, sy = vbH / room.height;
    // 10 cm subdivisions, 50 cm guide lines and emphasized full metres.
    // Integer decimetres avoid floating-point errors at 0.1 m boundaries.
    const gridLines = [];
    const makeGrid = (metres, scale, vertical) => {
        const divisions = Math.floor(metres * 10 + 1e-8);
        for (let index = 1; index < divisions; index++) {
            const position = (index / 10) * scale;
            const level = index % 10 === 0 ? 'major' : index % 5 === 0 ? 'minor' : 'fine';
            gridLines.push(vertical
                ? `<line class="warehouse-grid-${level}" x1="${position}" y1="0" x2="${position}" y2="${vbH}"/>`
                : `<line class="warehouse-grid-${level}" x1="0" y1="${position}" x2="${vbW}" y2="${position}"/>`);
        }
    };
    makeGrid(room.width, sx, true);
    makeGrid(room.height, sy, false);
    const grid = `<g class="warehouse-plan-grid" aria-hidden="true">${gridLines.join('')}</g>`;
    const items = room.furniture.filter(f => layer === 'all' || (layer === 'floor' ? (f.elevation ?? 0) === 0 : (f.elevation ?? 0) > 0))
        .slice().sort((a,b) => (a.elevation ?? 0) - (b.elevation ?? 0));
    const shapes = items.map((f, i) => {
        const fw = (f.rotation % 180 === 0 ? f.width : f.depth) * sx;
        const fh = (f.rotation % 180 === 0 ? f.depth : f.width) * sy;
        const x = f.x * sx, y = f.y * sy;
        const assigned = f.shelves.reduce((s, shelf) => s + count(w, shelf.id),0);
        return `<g class="warehouse-drag ${(f.elevation ?? 0)>0 ? 'warehouse-elevated' : 'warehouse-floor-level'} ${w.focusFurnitureId === f.id ? 'warehouse-selected':''}" data-id="${safe(f.id)}" role="button" tabindex="0" aria-label="${safe(t("warehouse.view.furnitureKeyboardHint",{name:f.name}))}" style="cursor:grab"><rect x="${x+1}" y="${y+1}" width="${Math.max(2,fw-2)}" height="${Math.max(2,fh-2)}" rx="3"/><text x="${x + fw/2}" y="${y + fh/2 - 4}" text-anchor="middle">${safe(f.name.slice(0,19))}</text><text x="${x+fw/2}" y="${y + fh/2 + 13}" text-anchor="middle">${(f.elevation ?? 0)>0 ? `${t("warehouse.view.fromElevation",{height:num(f.elevation)})} · ` : ''}${t("warehouse.view.abbreviatedBottleCount",{count:assigned})}</text></g>`;
    }).join('');
    return `<div class="warehouse-map-wrap"><svg class="warehouse-floor" viewBox="0 0 ${vbW} ${vbH}" data-room-id="${safe(room.id)}" aria-label="${safe(t("warehouse.view.roomPlanAria",{name:room.name}))}"><rect class="warehouse-boundary" x="1" y="1" width="${vbW-2}" height="${vbH-2}" rx="2"/>${grid}${shapes}<text class="warehouse-room-hint" x="10" y="${vbH-9}">${t("warehouse.view.twoDimensionalInstructions")}</text></svg></div>`;
}
function bottleSymbol(b) {
    const photo = b.photoPath ? `<img class="warehouse-bottle-photo" src="${safe(imageUrl(b.photoPath))}" alt="" loading="lazy">` : '';
    return `<button type="button" class="warehouse-bottle-symbol" data-act="warehouse-bottle-preview" data-id="${safe(b.id)}" title="${safe(t("warehouse.bottles.openDetailsNamed",{name:bottleLabel(b)}))}" aria-label="${safe(t("warehouse.bottles.openDetailsNamed",{name:bottleLabel(b)}))}"><svg viewBox="0 0 24 60" aria-hidden="true"><rect x="8" y="2" width="8" height="12" rx="2"/><path d="M8 14 Q3 19 3 25V54Q3 58 7 58H17Q21 58 21 54V25Q21 19 16 14Z"/><rect class="warehouse-label" x="5" y="31" width="14" height="16" rx="1"/></svg>${photo}</button>`;
}
/** Read-only summary for a physical bottle. The separate detail link keeps the
 * actual bottling route (including its physical-bottle highlight) accessible. */
function bottlePreview(w, bottle, bottling, physicalBottle) {
    const statusKey = {closed:'home.status.closed', open:'analytics.inventory.openedStatus', empty:'home.status.empty'}[bottle.status];
    const fields = [
        [t('forms.bottle.inventoryNumber'), bottle.number || t('imports.bottles.noInventoryNumber')],
        [t('forms.bottle.statusLabel'), statusKey ? t(statusKey) : null],
        [t('forms.bottle.type'), t(bottle.volumeType === 'sample' ? 'forms.bottle.sampleBottle' : 'forms.bottle.normalBottle')],
        [t('warehouse.bottles.volume'), bottle.volumeMl == null ? null : `${formatNumber(bottle.volumeMl)} ml`],
        [t('detail.fields.storageLocation'), storagePath(w, w.assignments[bottle.id])?.label || t('detail.fields.unassigned')],
        [t('forms.bottling.ageYears'), bottling?.ageYears == null ? null : t('home.facts.years', {count:bottling.ageYears})],
        [t('forms.bottling.abv'), bottling?.abv == null ? null : `${formatNumber(bottling.abv)} % Vol.`],
        [t('forms.bottle.purchaseDate'), physicalBottle?.purchaseDate],
        [t('forms.bottle.purchasePrice'), physicalBottle?.purchasePrice == null ? null : `${formatNumber(physicalBottle.purchasePrice)} ${physicalBottle.currency || 'EUR'}`],
        [t('forms.bottle.seller'), physicalBottle?.merchant],
        [t('forms.bottle.rating'), physicalBottle?.rating],
    ].filter(([,value]) => value !== null && value !== undefined && value !== '');
    const photo = bottle.photoPath
        ? `<img src="${safe(imageUrl(bottle.photoPath))}" alt="${safe(bottle.name)}">`
        : `<img src="/assets/photo-placeholder.svg" alt="" aria-hidden="true">`;
    const detailsLink = bottle.bottlingId
        ? `<a class="btn primary" href="${safe(routeUrl('detail', bottle.bottlingId))}" data-act="open" data-id="${safe(bottle.bottlingId)}" data-bottle-id="${safe(bottle.id)}">${t('warehouse.bottles.goToDetails')}</a>`
        : '';
    return `<div class="warehouse-bottle-preview">
        <div class="warehouse-bottle-preview-photo">${photo}</div>
        <div class="warehouse-bottle-preview-info"><strong class="warehouse-bottle-preview-name">${safe(bottle.name)}</strong>
            <dl class="warehouse-bottle-preview-fields">${fields.map(([label, value]) => `<div><dt>${safe(label)}</dt><dd>${safe(value)}</dd></div>`).join('')}</dl>
            ${physicalBottle?.comment ? `<div class="warehouse-bottle-preview-comment"><strong>${t('forms.bottle.personalComment')}</strong><p>${safe(physicalBottle.comment)}</p></div>` : ''}
        </div>
    </div>
    <div class="actions warehouse-bottle-preview-actions">
        <button type="button" class="btn" data-act="warehouse-assign" data-id="${safe(bottle.id)}">${t('warehouse.bottles.relocate')}</button>
        ${detailsLink}
    </div>`;
}
function shelfPanel(w, room, furniture) {
    const levels = shelfLevels(furniture);
    const shelves = levels.slice().reverse().map(level => {
        const shelf=level.shelf;
        const i=level.index;
        const occupants=w.bottles.filter(b=>w.assignments[b.id]===shelf.id);
        const range=doorRangeForIndex(furniture,i);
        const front=t(FRONT_KEYS[visibleShelfFront(furniture,i)]);
        const height=level.heightCm;
        const doorLabel = ['door','glass'].includes(range?.front || level.front) ? ` · ${(range?.doorLeaves ?? shelf.doorLeaves ?? furniture.doorLeaves ?? ((range?.front || level.front) === 'glass' ? 1 : 2)) === 1 ? t("warehouse.doors.singleLeaf") : t("warehouse.doors.doubleLeaf")}${(range?.front || level.front) === 'glass' ? ((range?.glassFrame ?? shelf.glassFrame ?? furniture.glassFrame) ? ` · ${t('warehouse.walls.withFrame').replace(/^./,ch=>ch.toLowerCase())}` : ` · ${t('warehouse.walls.withoutFrame').replace(/^./,ch=>ch.toLowerCase())}`) : ''}${range ? ` · ${t("warehouse.shelves.doorAcross",{from:range.from,to:range.to})}` : ''}` : '';
        return `<div class="warehouse-shelf"><div class="warehouse-shelf-head"><strong>${safe(shelf.name)}</strong>
            <span class="warehouse-shelf-meta">${safe(front)}${doorLabel} · ${num(height)} cm${shelf.heightCm == null ? ` ${t('warehouse.shelves.automaticHeight')}` : ''}${shelf.capacity === 0 ? '' : ` · ${occupants.length}${shelf.capacity === null?'':` / ${shelf.capacity}`} ${t("forms.bottle.plural")}`}</span>
            <div class="actions"><button class="btn small" type="button" data-act="warehouse-shelf-up" data-id="${safe(shelf.id)}" ${i===furniture.shelves.length-1 ? 'disabled' : ''} title="${t("warehouse.shelves.moveUp")}">↑</button><button class="btn small" type="button" data-act="warehouse-shelf-down" data-id="${safe(shelf.id)}" ${i===0 ? 'disabled' : ''} title="${t("warehouse.shelves.moveDown")}">↓</button><button class="btn small" data-act="warehouse-shelf-copy" data-id="${safe(shelf.id)}">${t("warehouse.furniture.copy")}</button><button class="btn small" data-act="warehouse-shelf-edit" data-id="${safe(shelf.id)}">${t("common.actions.edit")}</button><button class="btn small danger" data-act="warehouse-shelf-delete" data-id="${safe(shelf.id)}">${t("common.actions.remove")}</button></div></div>
            <div class="warehouse-bottle-silhouettes">${occupants.map(bottleSymbol).join('') || (shelf.capacity === 0 ? '' : `<span class="hint">${t('warehouse.shelves.empty')}</span>`)}</div></div>`;
    }).join('');
    const height=furnitureHeight(furniture);
    const used=levels.reduce((sum,entry)=>sum+entry.height,0);
    const topSpace=Math.max(0,Math.round((height-used)*100));
    return `<div class="panel warehouse-furniture-panel"><div class="warehouse-panel-head"><div><h3>${safe(furniture.name)} <span class="muted">(${safe(typeName(furniture.type))})</span></h3><p class="hint">${t("warehouse.furniture.sizeDescription", {width:num(furniture.width),depth:num(furniture.depth),rotation:furniture.rotation,elevation:num(furniture.elevation ?? 0),height:num(height),shelves:furniture.shelves.length})}</p></div><div class="actions"><button class="btn small" data-act="warehouse-furniture-copy" data-id="${safe(furniture.id)}">${t("warehouse.furniture.copy")}</button><button class="btn small" data-act="warehouse-furniture-edit" data-id="${safe(furniture.id)}">${t("common.actions.edit")}</button><button class="btn small danger" data-act="warehouse-furniture-delete" data-id="${safe(furniture.id)}">${t("common.actions.remove")}</button></div></div>
    <p class="warehouse-shelf-instruction">${t("warehouse.shelves.rangeStart")} <strong>${t("warehouse.shelves.orderTopDown")}</strong> ${t("warehouse.shelves.reorderAndCustomizeHint")}</p>
    ${topSpace>=1 ? `<p class="hint">${t("warehouse.shelves.remainingHeight", {height:num(topSpace)})}</p>`:''}
    <div class="warehouse-shelves">${shelves || `<p class="hint">${t("warehouse.shelves.noShelves")}</p>`}</div>
    <div class="actions"><button type="button" class="btn" data-act="warehouse-shelf-new" data-id="${safe(furniture.id)}">${t("warehouse.shelves.addWithPlus")}</button><button type="button" class="btn" data-act="warehouse-find">${t("warehouse.bottles.assign")}</button></div></div>`;
}


export { FRONT_KEYS, CAMERA_KEYS, ROOM_SECTION_KEYS, typeChoices, typeName, num, capacityLabel, safe, count, field, choices, footer, bottleLabel, bottleRow, bottlePreview, roomOptions, findFurniture, roomDiagram, shelfPanel };
