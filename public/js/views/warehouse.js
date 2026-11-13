import { escapeHtml as esc } from '../ui/dom.js';
import { t } from '../i18n/index.js';
import { roomCapacity, totalCapacity } from '../domain/warehouse-capacity.js';
import { toast } from '../ui/notifications.js';
import { request } from '../api.js';
import { revealActiveTab } from '../ui/tab-navigation.js';
import { WAREHOUSE_CAMERAS } from '../domain/warehouse-3d-model.js';
import { mountWarehouseThree } from '../ui/warehouse-three-scene.js';
import { mountWarehouseRoomPreviews } from '../ui/warehouse-room-previews.js';
import { moveFurnitureTowards } from '../domain/warehouse-placement.js';
import { routeUrl } from '../navigation/routes.js';
import { createFurnitureActivation } from '../ui/warehouse-furniture-activation.js';
import { eyeIcon, eyeOffIcon } from '../ui/action-icons.js';
import { renderWarehouseAssignment, mountWarehouseAssignment, assignmentPayload } from '../ui/warehouse-assignment.js';
import { FRONT_KEYS, CAMERA_KEYS, ROOM_SECTION_KEYS, typeChoices, typeName, num, capacityLabel, safe, count, field, choices, footer, bottleLabel, bottleRow, bottlePreview, roomOptions, findFurniture, roomDiagram, shelfPanel } from './warehouse-presentation.js';
export { storagePath } from './warehouse-presentation.js';
function attachBottlePhotos() {
    if (typeof document === 'undefined' || !document.querySelectorAll) return;
    document.querySelectorAll('.warehouse-bottle-photo').forEach(img => {
        const showIfLoaded = () => { if (img.naturalWidth > 0) img.parentElement?.classList.add('has-photo'); };
        if (img.complete) showIfLoaded();
        else img.addEventListener('load', showIfLoaded, {once:true});
    });
}

export function createWarehouseView({ state, shell, navigate, modal, refresh }) {
    let pendingDelete = null;
    let threeHandle = null;
    let roomPreviews = null;
    let threeTicket = 0;
    const w = () => state.warehouse;
    const currentRoom = () => roomOptions(w(), state.warehouseRoomId) || w().rooms[0];
    const currentFurniture = room => room?.furniture.find(f => f.id === state.warehouseFurnitureId);
    const selectedFurniture = room => (state.warehouseSelectedFurnitureIds || []).filter(id => room?.furniture.some(f => f.id === id));
    function selectionPanel(room, {isolate = false, compact = false} = {}) {
        if (!room.furniture.length) return `<p class="hint">${t("warehouse.rooms.noFurniture")}</p>`;
        const selected = new Set(selectedFurniture(room));
        const hiddenIds = new Set(state.warehouseHiddenFurnitureIds || []);
        return `<section class="warehouse-bulk-panel${compact ? ' warehouse-bulk-panel--sidebar' : ''}" aria-label="${t("warehouse.selection.instructions")}">
            <div class="warehouse-bulk-head"><strong>${t("warehouse.furniture.plural")}</strong><span class="warehouse-bulk-count" aria-live="polite">${t("warehouse.selection.count", {selected:selected.size,total:room.furniture.length})}</span>${isolate ? `<button type="button" class="btn small warehouse-show-all" data-act="warehouse-show-all" ${room.furniture.some(item => hiddenIds.has(item.id)) ? '' : 'disabled'}>${t("warehouse.visibility.showAll")}</button>` : ''}</div>
            <div class="warehouse-bulk-list">${room.furniture.map(furniture => {
                const occupied = furniture.shelves.reduce((n, shelf) => n + count(w(), shelf.id), 0);
                const visible = !hiddenIds.has(furniture.id);
                const actionLabel = t("warehouse.visibility.accessibleLabel", {name:furniture.name,action:t(visible ? "warehouse.visibility.hide" : "warehouse.visibility.show")});
                return `<div class="warehouse-bulk-item${state.warehouseFurnitureId===furniture.id?' is-current':''}${isolate && !visible?' is-hidden':''}"><label class="warehouse-bulk-select" title="${t("warehouse.furniture.selectForActions", {name:safe(furniture.name)})}"><input type="checkbox" class="warehouse-bulk-check" data-id="${safe(furniture.id)}" aria-label="${t("warehouse.furniture.selectForBulkEdit", {name:safe(furniture.name)})}" ${selected.has(furniture.id) ? 'checked' : ''}></label><button type="button" class="warehouse-bulk-open" data-act="warehouse-select-furniture" data-id="${safe(furniture.id)}" aria-label="${t("warehouse.shelves.showForFurniture", {name:safe(furniture.name)})}" ${state.warehouseFurnitureId===furniture.id?'aria-current="true"':''}><strong>${safe(furniture.name)}</strong><small>${t("warehouse.furniture.summary", {type:safe(typeName(furniture.type)),shelves:furniture.shelves.length,bottles:occupied})}</small></button>${isolate ? `<button type="button" class="btn warehouse-bulk-visibility" data-act="warehouse-visibility-toggle" data-id="${safe(furniture.id)}" aria-pressed="${visible}" title="${safe(actionLabel)}" aria-label="${safe(actionLabel)}">${visible ? eyeIcon : eyeOffIcon}</button>` : ''}</div>`;
            }).join('')}</div>
            <div class="actions warehouse-bulk-actions"><button type="button" class="btn small" data-act="warehouse-bulk-select-all">${t("warehouse.selection.selectAll")}</button><button type="button" class="btn small warehouse-bulk-clear-btn" data-act="warehouse-bulk-clear" ${selected.size ? '' : 'disabled'}>${t("warehouse.selection.clear")}</button><button type="button" class="btn small danger warehouse-bulk-delete-btn" data-act="warehouse-bulk-delete" ${selected.size ? '' : 'disabled'}>${t("warehouse.bulk.deleteAction", {count:selected.size})}</button><button type="button" class="btn small primary warehouse-bulk-edit-btn" data-act="warehouse-bulk-edit" ${selected.size ? '' : 'disabled'}>${t("warehouse.bulk.editAction", {count:selected.size})}</button></div>
        </section>`;
    }
    function setFurnitureVisibility(furniture, visible) {
        for (const button of document.querySelectorAll('.warehouse-bulk-visibility')) {
            if (button.dataset.id !== furniture.id) continue;
            const label = t("warehouse.visibility.accessibleLabel", {name:furniture.name,action:t(visible ? "warehouse.visibility.hide" : "warehouse.visibility.show")});
            button.setAttribute('aria-pressed', String(visible));
            button.setAttribute('aria-label', label);
            button.title = label;
            button.innerHTML = visible ? eyeIcon : eyeOffIcon;
            button.closest('.warehouse-bulk-item')?.classList.toggle('is-hidden', !visible);
        }
        threeHandle?.setFurnitureVisible?.(furniture.id, visible);
    }
    function updateShowAllButton(room) {
        const button = document.querySelector?.('.warehouse-show-all');
        if (button) button.disabled = !room.furniture.some(item => (state.warehouseHiddenFurnitureIds || []).includes(item.id));
    }
    function toggleFurnitureVisibility(id) {
        const room = currentRoom();
        const furniture = room?.furniture.find(item => item.id === id);
        if (!furniture) return false;
        const hidden = new Set(state.warehouseHiddenFurnitureIds || []);
        if (hidden.has(id)) hidden.delete(id); else hidden.add(id);
        state.warehouseHiddenFurnitureIds = [...hidden];
        const visible = !hidden.has(id);
        setFurnitureVisibility(furniture, visible);
        updateShowAllButton(room);
        return visible;
    }
    function showAllFurniture() {
        const room = currentRoom();
        if (!room) return 0;
        const hidden = new Set(state.warehouseHiddenFurnitureIds || []);
        const hiddenHere = room.furniture.filter(item => hidden.has(item.id));
        for (const furniture of hiddenHere) {
            hidden.delete(furniture.id);
            setFurnitureVisibility(furniture, true);
        }
        state.warehouseHiddenFurnitureIds = [...hidden];
        updateShowAllButton(room);
        return hiddenHere.length;
    }
    function syncBulkControls(room = currentRoom()) {
        const count = selectedFurniture(room).length;
        const label = document.querySelector('.warehouse-bulk-count');
        if (label) label.textContent = t("warehouse.selection.count",{selected:count,total:room?.furniture.length??0});
        const edit = document.querySelector('.warehouse-bulk-edit-btn');
        if (edit) {edit.disabled = count === 0; edit.textContent = t("warehouse.bulk.editAction", {count});}
        const remove = document.querySelector('.warehouse-bulk-delete-btn');
        if (remove) {remove.disabled = count === 0; remove.textContent = t("warehouse.bulk.deleteAction", {count});}
        const clear = document.querySelector('.warehouse-bulk-clear-btn');
        if (clear) clear.disabled = count === 0;
    }
    function toggleFurnitureSelection(id, checked) {
        const room = currentRoom();
        if (!room?.furniture.some(item => item.id === id)) return;
        const set = new Set(selectedFurniture(room));
        if (checked) set.add(id); else set.delete(id);
        state.warehouseSelectedFurnitureIds = [...set];
        syncBulkControls(room);
    }
    function selectAllFurniture() {
        const room = currentRoom();
        if (!room) return;
        state.warehouseSelectedFurnitureIds = room.furniture.map(item => item.id);
        document.querySelectorAll('.warehouse-bulk-check').forEach(el => {el.checked = true;});
        syncBulkControls(room);
    }
    function clearFurnitureSelection() {
        state.warehouseSelectedFurnitureIds = [];
        document.querySelectorAll('.warehouse-bulk-check').forEach(el => {el.checked = false;});
        syncBulkControls();
    }
    function render() {
        threeHandle?.dispose();
        threeHandle = null;
        roomPreviews?.dispose();
        roomPreviews = null;
        const currentTicket = ++threeTicket;
        const data = w();
        if (!data) return shell(`<p class="hint">${t("warehouse.storage.loading")}</p>`);
        const section = state.selected || 'overview';
        const total = data.bottles.length;
        const assigned = data.bottles.filter(b => !!data.assignments[b.id]).length;
        const overallCapacity = totalCapacity(data);
        let content = '';
        if (section === 'overview') {
            content = `<div class="warehouse-stats"><div><strong>${data.rooms.length}</strong><span>${t("warehouse.rooms.title")}</span></div><div><strong>${data.rooms.reduce((n,r)=>n+r.furniture.length,0)}</strong><span>${t("warehouse.furniture.plural")}</span></div><div><strong>${assigned} / ${total}</strong><span>${t("warehouse.bottles.assigned")}</span></div><div><strong>${overallCapacity.shelves===0 ? '–' : overallCapacity.unlimited && overallCapacity.defined===0 ? t('warehouse.capacity.open') : `${overallCapacity.defined}${overallCapacity.unlimited ? '+' : ''}`}</strong><span>${t('warehouse.capacity.title')}${overallCapacity.unlimited ? ` ${t('warehouse.capacity.unlimitedExtra',{count:overallCapacity.unlimited})}` : ''}</span></div></div><h3>${t("warehouse.rooms.yourRooms")}</h3><div class="warehouse-cards">${data.rooms.map(room => {const cap=roomCapacity(room,data);return `<button class="warehouse-room-card" data-act="warehouse-select-room" data-id="${safe(room.id)}"><span class="warehouse-room-preview" data-preview-room-id="${safe(room.id)}" aria-hidden="true">${t("warehouse.preview.loading3d")}</span><span class="warehouse-room-card-details"><strong data-i18n-ignore>${safe(room.name)}</strong><span>${t("warehouse.rooms.furnitureAndDimensions", {count:room.furniture.length,width:num(room.width),depth:num(room.height)})}</span><span>${t("warehouse.capacity.summary", {capacity:capacityLabel(cap)})}</span><span>${t("warehouse.occupancy.count", {count:cap.occupied})}</span></span></button>`;}).join('') || `<p class="hint">${t("warehouse.rooms.getStarted")}</p>`}</div><div class="actions"><button class="btn primary" data-act="warehouse-room-new">${t("warehouse.rooms.createWithPlus")}</button><button class="btn" data-act="warehouse-find">${t("warehouse.bottles.unassignedCount", {count:total-assigned})}</button></div>`;
        } else if (section === 'rooms' || section === 'shelves') {
            const room = currentRoom();
            const roomManagementActions = section === 'rooms'
                ? `<button class="btn" data-act="warehouse-room-new">${t("warehouse.rooms.addWithPlus")}</button>${room ? `<button class="btn" data-act="warehouse-room-edit" data-id="${safe(room.id)}">${t("warehouse.rooms.edit")}</button><button class="btn danger" data-act="warehouse-room-delete" data-id="${safe(room.id)}">${t("warehouse.rooms.delete")}</button>` : ''}`
                : '';
            content = `<div class="warehouse-room-toolbar"><label>${t("warehouse.rooms.select")} <select id="warehouse-room-select">${data.rooms.map(r=>`<option value="${safe(r.id)}" ${r.id===room?.id?'selected':''}>${safe(r.name)}</option>`).join('')}</select></label>${roomManagementActions}</div>`;
            if (room) {
                const furniture = currentFurniture(room);
                const cap = roomCapacity(room,data);
                const roomSummary = `<header class="warehouse-room-summary"><div class="warehouse-room-identity"><h3 data-i18n-ignore>${safe(room.name)}</h3><span>${t("warehouse.rooms.gridDimensions", {width:num(room.width),height:num(room.height)})}</span></div><div class="warehouse-room-metrics"><span>${t("warehouse.capacity.label")} <strong>${capacityLabel(cap)}</strong></span><span>${t("warehouse.occupancy.label")} <strong>${cap.occupied} ${cap.occupied===1?t("forms.bottle.title"):t("forms.bottle.plural")}</strong></span></div></header>`;
                const level = ['all','floor','elevated'].includes(state.warehousePlanLevel) ? state.warehousePlanLevel : 'all';
                const planMode = state.warehousePlanMode === '2d' ? '2d' : '3d';
                const planCorner = WAREHOUSE_CAMERAS.some(([id]) => id === state.warehousePlanCorner) ? state.warehousePlanCorner : 'nw';
                const zoom = [100, 150, 200].includes(state.warehousePlanZoom) ? state.warehousePlanZoom : 100;
                const viewSwitch = `<fieldset class="warehouse-view-switch" aria-label="${t("warehouse.view.planDisplay")}"><legend>${t("warehouse.view.label")}</legend><button type="button" data-act="warehouse-plan-mode" data-mode="2d" class="btn small${planMode==='2d'?' primary':''}" aria-pressed="${planMode==='2d'}">${t("warehouse.view.twoDimensional")}</button><button type="button" data-act="warehouse-plan-mode" data-mode="3d" class="btn small${planMode==='3d'?' primary':''}" aria-pressed="${planMode==='3d'}">${t("warehouse.view.threeDimensional")}</button></fieldset>`;
                const planFilter = planMode === '2d' ? `<label class="warehouse-plan-filter">${t("warehouse.fields.level")} <select id="warehouse-plan-layer" aria-label="${t("warehouse.view.furnitureLayer")}"><option value="all" ${level==='all'?'selected':''}>${t("warehouse.selection.allFurniture")}</option><option value="floor" ${level==='floor'?'selected':''}>${t("warehouse.furniture.floorStanding")}</option><option value="elevated" ${level==='elevated'?'selected':''}>${t("warehouse.furniture.elevated")}</option></select></label>` : `<label class="warehouse-plan-filter">${t("warehouse.view.zoom")} <select id="warehouse-plan-zoom" aria-label="${t("warehouse.view.zoomDescription")}">${[100,150,200].map(z=>`<option value="${z}" ${z===zoom?'selected':''}>${z} %</option>`).join('')}</select></label>`;
                const cornerButtons = planMode === '3d' ? `<div class="warehouse-camera-toolbar" role="group" aria-label="${t("warehouse.view.cameraAngle")}">${WAREHOUSE_CAMERAS.map(([id,label])=>`<button type="button" class="btn small${planCorner===id?' primary':''}" data-act="warehouse-camera" data-corner="${id}" aria-pressed="${planCorner===id}">${t(CAMERA_KEYS[id])}</button>`).join('')}</div>` : '';
                const planToolbar = `<div class="warehouse-plan-tools" role="toolbar" aria-label="${t("warehouse.view.toolbar")}">${viewSwitch}${cornerButtons}${planFilter}</div>`;
                const plan = planMode === '3d' ? `<div class="warehouse-three-viewport" role="region" aria-label="${t("warehouse.view.interactive3d")}">${t("warehouse.view.loading3d")}</div>` : roomDiagram(room,{...data,focusFurnitureId:furniture?.id},level);
                const details = furniture ? shelfPanel(data,room,furniture) : `<p class="hint warehouse-select-hint">${t("warehouse.shelves.selectFurnitureHint")}</p>`;
                if (section === 'rooms') {
                    const createButton = `<button type="button" class="btn primary" data-act="warehouse-furniture-new" data-id="${safe(room.id)}">${t("warehouse.furniture.place")}</button>`;
                    const instruction = planMode === '3d'
                        ? t("warehouse.view.threeDimensionalInstructions")
                        : t("warehouse.placement.twoDimensionalHint");
                    content += roomSummary + planToolbar
                        + (planMode === '3d'
                            ? `<div class="warehouse-plan-workspace"><div class="warehouse-plan-stage">${plan}</div>${selectionPanel(room, {isolate:true,compact:true})}</div>`
                            : `${plan}${selectionPanel(room)}`)
                        + `<div class="warehouse-plan-create">${createButton}</div>`
                        + `<p class="hint warehouse-plan-help">${instruction}</p>` + details;
                } else {
                    content += roomSummary + `<p class="warehouse-subtitle">${safe(t("warehouse.shelves.inRoom",{room:room.name}))}</p>`
                        + selectionPanel(room) + details;
                }
            } else content += `<p class="hint">${t("warehouse.rooms.noRooms")}</p>`;
        } else {
            const term = state.warehouseSearch || '';
            content = `<div class="warehouse-search-toolbar"><input type="search" id="warehouse-search" placeholder="${t("warehouse.bottles.searchPlaceholder")}" value="${safe(term)}" aria-label="${t("warehouse.bottles.searchInventory")}"><label><input type="checkbox" id="warehouse-unassigned" ${state.warehouseUnassigned?'checked':''}> ${t("warehouse.bottles.unassignedOnly")}</label></div><div class="warehouse-bottle-list">${data.bottles.filter(b=>!state.warehouseUnassigned || !data.assignments[b.id]).map(b=>bottleRow(data,b)).join('') || `<p class="hint">${t("warehouse.bottles.noResults")}</p>`}</div>`;
        }
        const warehouseTabs = ['overview', 'rooms', 'shelves', 'find'].map(id => [id, t(ROOM_SECTION_KEYS[id])]);
        const nav = `<nav class="analytics-tabs warehouse-tabs" aria-label="${t("warehouse.rooms.storageAreas")}">${warehouseTabs.map(([id, label]) => `<button type="button" class="analytics-tab${section === id ? ' active' : ''}" data-act="warehouse-section" data-section="${id}" aria-current="${section === id ? 'page' : 'false'}">${label}</button>`).join('')}</nav>`;
        shell(`<div class="analytics-page warehouse-page"><header class="analytics-header warehouse-heading"><span class="eyebrow dark">${t("warehouse.page.eyebrow")}</span><h2>${t("warehouse.page.title")}<span class="heading-period">.</span></h2><p>${esc(t('warehouse.page.intro'))}</p></header>${nav}${content}<p class="warehouse-note">${t("warehouse.storage.dataFilePrefix")} <code>${'data/warehouse.json'}</code> ${t("warehouse.storage.dataFileSuffix")}</p></div>`);
        if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
            revealActiveTab(document.querySelector('.warehouse-tabs'));
        }
        if (section === 'overview') roomPreviews = mountWarehouseRoomPreviews({rooms:data.rooms,warehouse:data});
        if (section === 'rooms') attachDrag();
        if (section === 'rooms' || section === 'shelves') attachFurnitureHover(section === 'rooms');
        if (section === 'shelves' || section === 'rooms') attachBottlePhotos();
        const threeViewport = typeof document === 'undefined' ? null : document.querySelector('.warehouse-three-viewport');
        if (threeViewport && section === 'rooms') {
            const room = currentRoom();
            const corner = WAREHOUSE_CAMERAS.some(([id])=>id===state.warehousePlanCorner) ? state.warehousePlanCorner : 'nw';
            const initialHidden = new Set(state.warehouseHiddenFurnitureIds || []);
            mountWarehouseThree(threeViewport,{room,warehouse:data,corner,zoom:state.warehousePlanZoom||100,hiddenIds:[...initialHidden],onSelect:selectFurniture,onEdit:id=>openForm('furniture',id)})
                .then(handle=>{if (threeTicket===currentTicket && threeViewport.isConnected) { threeHandle=handle; handle?.setZoom?.(state.warehousePlanZoom||100);
                            for (const furniture of room.furniture) {
                                const nowHidden = (state.warehouseHiddenFurnitureIds || []).includes(furniture.id);
                                if (initialHidden.has(furniture.id) !== nowHidden) handle?.setFurnitureVisible?.(furniture.id, !nowHidden);
                            }
                            const hovered=document.querySelector('.warehouse-bulk-item:hover');
                            if (hovered) handle?.setHighlightedFurniture?.(hovered.querySelector('.warehouse-bulk-open')?.dataset.id);
 }
                    else handle?.dispose?.();})
                .catch(error=>{
                    console.error('Three.js-Lageransicht konnte nicht gestartet werden:',error);
                    if(threeTicket===currentTicket && threeViewport.isConnected) threeViewport.textContent=t('warehouse.view.threeUnavailable');
                });
        }
        if (section === 'find') filterSearch();
    }
    function attachFurnitureHover(withPlan) {
        // The list is re-created on render; keep hover handlers local to its lifetime.
        // Only the pointer/focus visual state changes: no selection, navigation or WebGL rebuild.
        const list = document.querySelector('.warehouse-bulk-list');
        if (!list?.querySelectorAll) return;
        function highlight(id) {
            if (withPlan) {
                threeHandle?.setHighlightedFurniture?.(id);
                document.querySelectorAll('.warehouse-drag').forEach(node => {
                    node.classList.toggle('warehouse-hovered',node.dataset.id === id);
                });
            }
        }
        for (const tile of list.querySelectorAll('.warehouse-bulk-item')) {
            const id = tile.querySelector('.warehouse-bulk-open')?.dataset.id;
            if (!id) continue;
            tile.addEventListener('pointerenter', () => highlight(id));
            tile.addEventListener('pointerleave', () => highlight(null));
            tile.addEventListener('focusin', () => highlight(id));
            tile.addEventListener('focusout', event => {
                if (!tile.contains(event.relatedTarget)) highlight(null);
            });
        }
    }
    function update3DZoom(value) { return threeHandle?.setZoom(value) ?? false; }
    function doorRangeRow(range = {}, count = 0) {
        const opts = (chosen) => Array.from({length:count},(_,i)=>`<option value="${i+1}" ${chosen===i+1?'selected':''}>${t("warehouse.shelves.numbered", {index:i+1})}</option>`).join('');
        return `<div class="warehouse-door-range" style="display:flex;flex-wrap:wrap;align-items:end;gap:.5rem;margin:.6rem 0;padding:.6rem;border:1px solid var(--border-color,#888);border-radius:.4rem">
            <label class="form-field">${t("warehouse.shelves.rangeBottom")}<select class="door-range-from">${opts(range.from || 1)}</select></label>
            <label class="form-field">${t("warehouse.range.endTop")}<select class="door-range-to">${opts(range.to || count)}</select></label>
            <label class="form-field">${t("warehouse.shelves.doorLabel")}<select class="door-range-front"><option value="door" ${range.front!=='glass'?'selected':''}>${t("warehouse.front.woodDoorLabel")}</option><option value="glass" ${range.front==='glass'?'selected':''}>${t("warehouse.front.glassDoorLabel")}</option></select></label>
            <label class="form-field">${t("warehouse.shelves.doorLeaves")}<select class="door-range-leaves"><option value="" ${range.doorLeaves==null?'selected':''}>${t("warehouse.fields.furnitureDefault")}</option><option value="1" ${range.doorLeaves===1?'selected':''}>1</option><option value="2" ${range.doorLeaves===2?'selected':''}>2</option></select></label>
            <label class="form-field">${t("warehouse.walls.glassFrame")}<select class="door-range-frame"><option value="" ${range.glassFrame==null?'selected':''}>${t("warehouse.fields.furnitureDefault")}</option><option value="true" ${range.glassFrame===true?'selected':''}>${t("warehouse.walls.withFrame")}</option><option value="false" ${range.glassFrame===false?'selected':''}>${t("warehouse.walls.withoutFrame")}</option></select></label>
            <button type="button" class="btn small danger warehouse-door-range-remove">${t("common.actions.remove")}</button>
        </div>`;
    }
    function openBottlePreview(id) {
        const bottle = w()?.bottles.find(entry => entry.id === id);
        if (!bottle) return toast(t('features.errors.bottleNotFound'), true);
        const bottling = state.collection?.bottlings.find(entry => entry.id === bottle.bottlingId);
        const physicalBottle = bottling?.bottles.find(entry => entry.id === bottle.id);
        modal.showModal(t('warehouse.bottles.detailsTitle'), bottlePreview(w(), bottle, bottling, physicalBottle));
    }
    function openForm(kind, id) {
        const data = w();
        let endpoint = '', method = 'POST', title = '', fields = '';
        if (kind === 'room') {
            const item = data.rooms.find(r=>r.id===id);
            title = item?t("warehouse.rooms.edit"):t("warehouse.rooms.create");
            endpoint = item?`/api/warehouse/rooms/${item.id}`:'/api/warehouse/rooms'; method=item?'PATCH':'POST';
            fields = field('name',t("warehouse.rooms.roomName"),item?.name||'')+field('width',t("warehouse.fields.widthMeters"),item?.width??4,'number','step="0.01" min="1" max="100"')+field('height',t("warehouse.fields.depthMeters"),item?.height??4,'number','step="0.01" min="1" max="100"');
        } else if (kind === 'furniture') {
            const found = findFurniture(data,id);
            const room = found?.room || currentRoom();
            if (!room) return toast(t("warehouse.empty.createRoomFirst"),true);
            const item = found?.furniture;
            title = item?t("warehouse.furniture.edit"):t("warehouse.furniture.add");
            endpoint=item?`/api/warehouse/furniture/${item.id}`:`/api/warehouse/rooms/${room.id}/furniture`;method=item?'PATCH':'POST';
            fields=field('name',t("warehouse.fields.name"),item?.name||t("warehouse.furniture.defaultShelfName"))+choices('type',t("warehouse.fields.furnitureType"),typeChoices(),item?.type||'regal')+field('x',t("warehouse.fields.positionXMeters"),item?.x??0,'number','step="0.01" min="0"')+field('y',t("warehouse.fields.positionYMeters"),item?.y??0,'number','step="0.01" min="0"')+field('width',t("warehouse.fields.widthMetersShort"),item?.width??1,'number','min="0.2" step="0.01"')+field('depth',t("warehouse.fields.depthMetersShort"),item?.depth??0.5,'number','min="0.2" step="0.01"')+choices('rotation',t("warehouse.fields.rotation"),[[0,'0°'],[90,'90°'],[180,'180°'],[270,'270°']],item?.rotation??0)
                +field('elevation',t("warehouse.fields.bottomElevationMeters"),item?.elevation??0,'number','step="0.01" min="0" max="10"')
                +field('itemHeight',t("warehouse.fields.furnitureHeightMeters"),item?.itemHeight??(item?.type==='haengeregal'?0.4:1.8),'number','step="0.01" min="0.1" max="5"')
                +choices('doorLeaves',t("warehouse.walls.doorLeavesDefault"), [['',t('warehouse.shelves.defaultWoodDoors')],['1',t('warehouse.doors.singleLeaf')],['2',t('warehouse.doors.doubleLeaf')]],String(item?.doorLeaves ?? ''))
                +choices('glassFrame',t("warehouse.walls.glassDoorFrameDefault"), [['',t('warehouse.walls.withoutFrameDefault')],['true',t('warehouse.walls.withFrame')],['false',t('warehouse.walls.withoutFrame')]],String(item?.glassFrame ?? ''))
                +(item?.shelves.length ? `<div class="warehouse-door-ranges" style="grid-column:1/-1"><strong>${t("warehouse.shelves.doorRangesHeading")}</strong><p class="hint">${t("warehouse.shelves.doorRangesHelp")}</p><div class="warehouse-door-range-list">${(item.doorRanges || []).map(range=>doorRangeRow(range,item.shelves.length)).join('')}</div><button type="button" class="btn small warehouse-door-range-add">${t("warehouse.shelves.addDoorRange")}</button></div>` : '')
                +`<fieldset class="warehouse-wall-options"><legend>${t("warehouse.walls.furniturePanels")}</legend><p class="hint">${t("warehouse.walls.description")}</p><div class="warehouse-wall-toggles">${[['leftSidePanel',t('warehouse.walls.leftPanel'),'left'],['rightSidePanel',t('warehouse.walls.rightPanel'),'right'],['backPanel',t('warehouse.walls.backPanel'),'back']].map(([key,label,side])=>`<label class="warehouse-wall-toggle"><input type="checkbox" name="${key}" ${item?.[key]===true?'checked':''}><span class="warehouse-wall-pictogram warehouse-wall-pictogram--${side}" aria-hidden="true"></span><span class="warehouse-wall-label">${label}<small class="warehouse-wall-state"></small></span></label>`).join('')}</div></fieldset>`
                +`<p class="hint warehouse-copy-hint">${t("warehouse.placement.verticalOverlapHint")}</p>`;
        } else if (kind === 'furniture-bulk') {
            const room = currentRoom();
            const ids = selectedFurniture(room);
            if (!ids.length) return toast(t("warehouse.validation.selectFurnitureFirst"), true);
            title = t("warehouse.bulk.editTitle", {count:ids.length});
            endpoint = '/api/warehouse/furniture/bulk'; method = 'PATCH';
            const bulkField = (control) => `<div class="warehouse-bulk-field">${control}</div>`;
            const optionalNumber = (key, label, constraints) => `<label class="form-field">${safe(label)}<input type="number" name="${key}" placeholder="${t("warehouse.fields.unchanged")}" ${constraints}></label>`;
            fields = `<p class="hint warehouse-copy-hint">${t("warehouse.selection.bulkDescription",{names:ids.map(id => room.furniture.find(f => f.id === id)?.name).map(safe).join(', ')})}</p>`
                +bulkField(`<label class="form-field">${t("warehouse.fields.angle")}<select name="rotation"><option value="">${t("warehouse.fields.unchanged")}</option>${[[0,'0°'],[90,'90°'],[180,'180°'],[270,'270°']].map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label>`)
                +bulkField(optionalNumber('elevation',t('warehouse.fields.bottomElevationShort'),'step="0.01" min="0" max="10"'))
                +bulkField(optionalNumber('itemHeight',t('warehouse.fields.heightShort'),'step="0.01" min="0.1" max="5"'))
                +bulkField(optionalNumber('width',t('warehouse.fields.widthShort'),'step="0.01" min="0.2" max="20"'))
                +bulkField(optionalNumber('depth',t('warehouse.fields.depthShort'),'step="0.01" min="0.2" max="20"'))
                +bulkField(choices('doorLeaves',t("warehouse.walls.doorLeavesFurnitureDefault"), [['',t('warehouse.fields.unchanged')],['1',t('warehouse.doors.singleLeaf')],['2',t('warehouse.doors.doubleLeaf')],['default',t('warehouse.walls.automatic')]]))
                +bulkField(choices('glassFrame',t("warehouse.walls.glassDoorFrameFurnitureDefault"), [['',t('warehouse.fields.unchanged')],['true',t('warehouse.walls.withFrame')],['false',t('warehouse.walls.withoutFrame')],['default',t('warehouse.walls.automatic')]]))
                +['leftSidePanel','rightSidePanel','backPanel'].map((key,i)=>bulkField(choices(key,[t('warehouse.walls.leftPanel'),t('warehouse.walls.rightPanel'),t('warehouse.walls.backPanel')][i],[['',t('warehouse.fields.unchanged')],['true',t('warehouse.walls.present')],['false',t('warehouse.walls.absent')]]))).join('')
                +`<p class="hint warehouse-copy-hint">${t("warehouse.bulk.validationHint")}</p>`;
        } else if (kind === 'shelf') {
            let found = null;
            for (const room of data.rooms) for (const furniture of room.furniture) for (const shelf of furniture.shelves) if (shelf.id === id) found = {shelf,furniture};
            const item = found?.shelf;
            const furnitureId = found?.furniture?.id || id;
            title = item?t("warehouse.shelves.edit"):t("warehouse.shelves.add");
            endpoint=item?`/api/warehouse/shelves/${item.id}`:`/api/warehouse/furniture/${furnitureId}/shelves`; method=item?'PATCH':'POST';
            fields=field('name',t("warehouse.shelves.name"),item?.name||t('warehouse.shelves.numbered',{index:(findFurniture(data,furnitureId)?.furniture.shelves.length||0)+1}))
                +`<label class="form-field">${t("warehouse.shelves.capacityHint")}<input type="number" name="capacity" min="0" max="10000" value="${safe(item?.capacity??'')}"></label>`
                +choices('front',t("warehouse.shelves.frontType"), [['',t('warehouse.shelves.defaultFront')],...['open','door','glass','drawer'].map(id=>[id,t(FRONT_KEYS[id])])], item?.front ?? '')
                +choices('doorLeaves',t("warehouse.walls.doorLeaves"), [['',t('warehouse.fields.furnitureDefaultAutomatic')],['1',t('warehouse.doors.singleLeaf')],['2',t('warehouse.doors.doubleLeaf')]], String(item?.doorLeaves ?? ''))
                +choices('glassFrame',t("warehouse.walls.glassDoorFrame"), [['',t('warehouse.fields.furnitureDefaultWithoutFrame')],['false',t('warehouse.walls.withoutFrame')],['true',t('warehouse.walls.withFrame')]], String(item?.glassFrame ?? ''))
                +`<label class="form-field">${t("warehouse.shelves.heightCentimetersOptional")}<input type="number" name="heightCm" min="5" max="500" step="0.5" placeholder="${t("warehouse.fields.automatic")}" value="${safe(item?.heightCm ?? '')}"></label>`
                +`<p class="hint warehouse-copy-hint">${t("warehouse.shelves.heightDistributionHint")}</p>`;
        } else if (kind === 'furniture-copy') {
            const found = findFurniture(data, id);
            if (!found) return toast(t("warehouse.furniture.notFound"),true);
            title = t('warehouse.furniture.copyTitle',{type:typeName(found.furniture.type)});
            endpoint = `/api/warehouse/furniture/${safe(id)}/copy`;
            fields = field('name',t("warehouse.furniture.copyName"),t("warehouse.furniture.copyNameSuffix",{name:found.furniture.name}))
                + choices('roomId',t("warehouse.bottles.destinationRoom"),data.rooms.map(r=>[r.id,r.name]),found.room.id)
                + `<label class="warehouse-copy-option"><input type="checkbox" name="withShelves" checked> ${t("warehouse.shelves.copyAllIncludingCapacity")}</label>`
                + `<p class="hint warehouse-copy-hint">${t("warehouse.furniture.copyDoesNotAssignBottles")}</p>`;
        } else if (kind === 'shelf-copy') {
            let found = null;
            for (const room of data.rooms) for (const furniture of room.furniture) for (const shelf of furniture.shelves) {
                if (shelf.id === id) found = {shelf,furniture};
            }
            if (!found) return toast(t("warehouse.shelves.notFound"),true);
            title = t('warehouse.shelves.copyTitle');
            endpoint = `/api/warehouse/shelves/${safe(id)}/copy`;
            fields = field('name',t("warehouse.furniture.copyName"),t("warehouse.furniture.copyNameSuffix",{name:found.shelf.name}))
                + choices('furnitureId',t("warehouse.bottles.destinationFurniture"),data.rooms.flatMap(r=>r.furniture.map(f=>[f.id,`${r.name} / ${f.name}`])),found.furniture.id)
                + `<p class="hint warehouse-copy-hint">${t("warehouse.shelves.copyDescription")}</p>`;
        } else if (kind === 'assign') {
            const bottle = data.bottles.find(b=>b.id===id);
            if (!bottle) return toast(t("features.errors.bottleNotFound"),true);
            title=t('warehouse.bottles.assignTitle'); endpoint=`/api/warehouse/bottles/${id}`;method='PUT';
            fields=renderWarehouseAssignment(data,bottle);
        }
        modal.showModal(title,`<form id="warehouse-form" data-endpoint="${safe(endpoint)}" data-method="${method}" data-new-furniture="${kind==='furniture'&&!id?'true':'false'}" data-bulk="${kind==='furniture-bulk'}" class="warehouse-form${kind==='assign'?' warehouse-assignment-form':''}"><div class="forms">${fields}</div>${footer()}</form>`, kind === 'assign');
        if (kind === 'assign') mountWarehouseAssignment(document.querySelector('#warehouse-form'), data, id);
        const editor = document.querySelector('.warehouse-door-ranges');
        if (editor) editor.addEventListener('click', event => {
            if (event.target.closest('.warehouse-door-range-remove')) event.target.closest('.warehouse-door-range')?.remove();
            if (event.target.closest('.warehouse-door-range-add')) {
                const list = editor.querySelector('.warehouse-door-range-list');
                const shelfCount = findFurniture(w(), id)?.furniture.shelves.length || 0;
                list.insertAdjacentHTML('beforeend',doorRangeRow({},shelfCount));
            }
        });
    }
    async function submit(event) {
        event.preventDefault();
        const form=event.target;
        if (form.dataset.bulk === 'true') {
            const changes = {};
            for (const key of ['rotation','elevation','itemHeight','width','depth']) {
                const value = form.elements.namedItem(key)?.value;
                if (value !== undefined && value !== '') changes[key] = Number(value);
            }
            for (const key of ['doorLeaves','glassFrame']) {
                const value=form.elements.namedItem(key)?.value;
                if (value === 'default') changes[key]=null;
                else if (value !== undefined && value !== '') changes[key]=key === 'doorLeaves' ? Number(value) : value === 'true';
            }
            for (const key of ['leftSidePanel','rightSidePanel','backPanel']) {
                const value=form.elements.namedItem(key)?.value;
                if (value === 'true' || value === 'false') changes[key]=value === 'true';
            }
            if (!Object.keys(changes).length) return toast(t("warehouse.validation.atLeastOneField"),true);
            const ids = selectedFurniture(currentRoom());
            if (!ids.length) return toast(t("warehouse.selection.noFurniture"),true);
            try {
                const result = await request('/api/warehouse/furniture/bulk', {method:'PATCH', body:JSON.stringify({ids,changes})});
                modal.closeModal();
                await refresh();
                toast(t("warehouse.bulk.editedSuccess", {count:result.count}));
            } catch(err) {toast(err.message,true);}
            return;
        }
        let data=Object.fromEntries(new FormData(form).entries());
        if (form.classList.contains('warehouse-assignment-form')) {
            try { data=assignmentPayload(data.warehouseAssignmentMode,form.querySelector('[data-assignment-shelf]')?.value,w()); }
            catch (error) { toast(error.message,true); return; }
        }
        for (const key of ['width','height','depth','x','y','rotation','elevation','itemHeight']) if (key in data) data[key] = Number(data[key]);
        if (form.dataset.newFurniture === 'true' || ['leftSidePanel','rightSidePanel','backPanel'].some(key=>form.elements.namedItem(key))) {
            for (const key of ['leftSidePanel','rightSidePanel','backPanel']) if (form.elements.namedItem(key)) data[key] = form.elements.namedItem(key).checked;
        }
        if (form.elements.namedItem('doorLeaves')) data.doorLeaves = data.doorLeaves === '' ? null : Number(data.doorLeaves);
        if (form.elements.namedItem('glassFrame')) data.glassFrame = data.glassFrame === '' ? null : data.glassFrame === 'true';
        if (form.querySelector('.warehouse-door-ranges')) {
            data.doorRanges = [...form.querySelectorAll('.warehouse-door-range')].map(row=>({
                from:Number(row.querySelector('.door-range-from').value),to:Number(row.querySelector('.door-range-to').value),
                front:row.querySelector('.door-range-front').value,
                doorLeaves:row.querySelector('.door-range-leaves').value === '' ? null : Number(row.querySelector('.door-range-leaves').value),
                glassFrame:row.querySelector('.door-range-frame').value === '' ? null : row.querySelector('.door-range-frame').value === 'true'
            }));
        }
        if ('capacity' in data) data.capacity = data.capacity === '' ? null : Number(data.capacity);
        if ('heightCm' in data) data.heightCm = data.heightCm === '' ? null : Number(data.heightCm);
        if ('front' in data) data.front = data.front || null;
        if ('shelfId' in data) data.shelfId=data.shelfId||null;
        if (form.querySelector('[name="withShelves"]')) data.withShelves = form.querySelector('[name="withShelves"]').checked;
        try {
            const result = await request(form.dataset.endpoint,{method:form.dataset.method,body:JSON.stringify(data)});
            if (form.dataset.endpoint.endsWith('/copy')) {
                const copiedFurniture = form.querySelector('[name="withShelves"]');
                if (copiedFurniture) {
                    state.warehouseRoomId=data.roomId;
                    state.warehouseFurnitureId=result.id;
                } else {
                    for (const room of w().rooms) for (const furniture of room.furniture) if (furniture.id === data.furnitureId) {
                        state.warehouseRoomId=room.id;
                        state.warehouseFurnitureId=furniture.id;
                    }
                }
            }
            modal.closeModal();await refresh();toast(form.dataset.endpoint.endsWith('/copy')?t("warehouse.furniture.copiedWithoutAssignments"):t("warehouse.storage.saved"));
        }
        catch(err){toast(err.message,true);}
    }
    async function moveShelf(id,direction) {
        try {
            await request(`/api/warehouse/shelves/${encodeURIComponent(id)}/move`, {method:'PATCH',body:JSON.stringify({direction})});
            await refresh();
        } catch(error) {toast(error.message,true);}
    }
    function askBulkDelete() {
        const room=currentRoom();
        const ids=selectedFurniture(room);
        if (!ids.length) return toast(t("warehouse.selection.noFurniture"),true);
        pendingDelete={ids};
        modal.showModal(t("warehouse.bulk.deleteTitle", {count:ids.length}), `<p>${t("warehouse.bulk.deleteConfirmation", {count:ids.length})}</p><p class="hint">${ids.map(id=>room.furniture.find(f=>f.id===id)?.name).map(safe).join(', ')}</p><p>${t("warehouse.bulk.deleteOccupiedWarning")}</p><div class="actions warehouse-form-actions"><button type="button" class="btn" data-act="close-modal">${t("common.actions.cancel")}</button><button type="button" class="btn danger" data-act="warehouse-confirm-delete">${t("warehouse.bulk.deleteAction", {count:ids.length})}</button></div>`);
    }
    function askDelete(kind,id) {
        const endpoints={room:`/api/warehouse/rooms/${id}`,furniture:`/api/warehouse/furniture/${id}`,shelf:`/api/warehouse/shelves/${id}`};
        pendingDelete=endpoints[kind];
        modal.showModal(t("warehouse.bottles.removeStorageLocation"),`<p>${t("warehouse.shelves.deleteOccupiedConfirmation")}</p><div class="actions warehouse-form-actions"><button type="button" class="btn" data-act="close-modal">${t("common.actions.cancel")}</button><button type="button" class="btn danger" data-act="warehouse-confirm-delete">${t("common.actions.remove")}</button></div>`);
    }
    async function deleteConfirmed(){
        if(!pendingDelete)return;
        const target=pendingDelete;pendingDelete=null;
        try {
            const bulk=typeof target === 'object';
            await request(bulk?'/api/warehouse/furniture/bulk/delete':target,{method:bulk?'POST':'DELETE',...(bulk?{body:JSON.stringify(target)}:{})});
            modal.closeModal();state.warehouseFurnitureId=null;
            if(bulk) state.warehouseSelectedFurnitureIds=[];
            await refresh();toast(bulk?t("warehouse.bulk.deletedSuccess", {count:target.ids.length}):t("warehouse.bottles.storageLocationRemoved"));
        }catch(err){toast(err.message,true);}
    }
    function selectRoom(id, section = 'rooms') {state.warehouseSelectedFurnitureIds=[];state.warehouseRoomId=id;state.warehouseFurnitureId=null;navigate('warehouse',section);}
    function selectFurniture(id) {
        const found = findFurniture(w(), id);
        if (!found) return;
        state.warehouseRoomId = found.room.id;
        state.warehouseFurnitureId = id;
        // Selecting furniture is not a page change: the router otherwise scrolls to the top.
        if (typeof window !== 'undefined' && window.history?.replaceState && ['rooms','shelves'].includes(state.selected)) {
            window.history.replaceState({whiskyRoute:true}, '', routeUrl('warehouse', state.selected, {roomId:found.room.id, furnitureId:id}));
        }
        render();
        const target = typeof document !== 'undefined' ? document.querySelector?.('.warehouse-furniture-panel') : null;
        if (target && typeof window !== 'undefined' && Number.isFinite(window.innerHeight) && Number.isFinite(window.scrollY)) {
            // Short shelf panels can sit near the bottom of the document; add only the
            // space required for the selected panel to reach the top of the viewport.
            const page = target.closest?.('.warehouse-page');
            const scrollHeight = document.documentElement?.scrollHeight;
            if (page && Number.isFinite(scrollHeight)) {
                const desiredY = window.scrollY + target.getBoundingClientRect().top - 16;
                const missing = desiredY - Math.max(0, scrollHeight - window.innerHeight);
                if (missing > 0) page.style.paddingBottom = `${Math.ceil(missing) + 2}px`;
            }
        }
        target?.scrollIntoView?.({block:'start', behavior:'instant'});
    }
    function filterSearch() {const term=(document.getElementById('warehouse-search')?.value||'').trim().toLocaleLowerCase('de');for (const row of document.querySelectorAll('.warehouse-bottle-row')) row.hidden = !row.dataset.bottleSearch.includes(term);}
    function attachDrag(){
        const svg=document.querySelector('.warehouse-floor'); if(!svg)return;
        let drag=null;
        const activation = createFurnitureActivation(selectFurniture, id => openForm('furniture', id));
        svg.addEventListener('keydown', event => {
            const furniture = event.target.closest?.('.warehouse-drag');
            if (!furniture) return;
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (event.shiftKey) openForm('furniture', furniture.dataset.id);
                else selectFurniture(furniture.dataset.id);
            }
        });
        svg.addEventListener('pointerdown', e=>{
            const g=e.target.closest('.warehouse-drag');if(!g || e.button!==0)return;
            const found=findFurniture(w(),g.dataset.id);if(!found)return;
            drag={id:g.dataset.id,origX:found.furniture.x,origY:found.furniture.y,startX:e.clientX,startY:e.clientY,newX:found.furniture.x,newY:found.furniture.y,moved:false,room:found.room};
            svg.setPointerCapture(e.pointerId);e.preventDefault();
        });
        svg.addEventListener('pointermove',e=>{
            if(!drag)return;
            const rect=svg.getBoundingClientRect();if(rect.width===0||rect.height===0)return;
            const item=findFurniture(w(),drag.id)?.furniture;if(!item)return;
            const dx=(e.clientX-drag.startX)*drag.room.width/rect.width;
            const dy=(e.clientY-drag.startY)*drag.room.height/rect.height;
            if(Math.abs(e.clientX-drag.startX)+Math.abs(e.clientY-drag.startY)>6)drag.moved=true;
            // The preview uses the same 3D collision rules as the server. A fast
            // pointer movement cannot jump through another piece of furniture.
            const position = moveFurnitureTowards(drag.room, item, drag.newX, drag.newY, drag.origX + dx, drag.origY + dy);
            const x=position.x, y=position.y;
            drag.newX=x;drag.newY=y;
            const vb=svg.viewBox.baseVal;
            const g=svg.querySelector(`.warehouse-drag[data-id="${drag.id}"]`);
            if(g){const shape=g.querySelector('rect');if(shape){const tx=x*vb.width/drag.room.width, ty=y*vb.height/drag.room.height;const oldX=parseFloat(shape.getAttribute('x'))-1,oldY=parseFloat(shape.getAttribute('y'))-1;g.setAttribute('transform',`translate(${tx-oldX} ${ty-oldY})`);}}
        });
        svg.addEventListener('pointerup',async e=>{
            if(!drag)return;const current=drag;drag=null;
            if(!current.moved){activation.activate(current.id);return;}
            const item=findFurniture(w(),current.id)?.furniture;if(!item)return;
            try{await request(`/api/warehouse/furniture/${current.id}`,{method:'PATCH',body:JSON.stringify({...item,x:current.newX??item.x,y:current.newY??item.y})});await refresh();}
            catch(err){toast(err.message,true);render();}
        });
        svg.addEventListener('pointercancel',()=>{drag=null;render();});
    }
    return {render, update3DZoom, toggleFurnitureVisibility, showAllFurniture, openForm, openBottlePreview, submit, moveShelf, askDelete, deleteConfirmed, selectRoom, selectFurniture, filterSearch, toggleFurnitureSelection, selectAllFurniture, clearFurnitureSelection, askBulkDelete};
}
