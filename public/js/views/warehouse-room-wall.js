/** @fileoverview Renders the prepared physical storage-wall view model. */
import {composeMarkup, RenderPlan} from '../ui/render-plan.js';
import {wallFurnitureGroups} from '../domain/warehouse-wall-layout.js';
import {renderUnassignedTray} from './warehouse-unassigned-tray.js';
import {t} from '../i18n/index.js';
import {bottleSymbol, num, safe} from './warehouse-presentation.js';
import {loadTemplates} from '../ui/templates.js';
import {createWarehouseWallViewModel} from './models/warehouse-wall.js';
export {WALL_PIXELS_PER_METRE} from './models/warehouse-wall.js';

const renderTemplate = await loadTemplates('warehouse/warehouse-room-wall.html');

/**
 * Returns furniture in physical order by wall orientation and room position.
 * @param {!Object} room Room model containing dimensions and furniture.
 * @return {!Array<!Object>} Ordered furniture records.
 */
export function wallFurniture(room) {
  return wallFurnitureGroups(room).flatMap(group => group.items.map(item => item.furniture));
}

/**
 * Creates a selectable bottle preview using prepared focus and selection flags.
 * @param {!Object} model Prepared bottle presentation.
 * @return {!RenderPlan} Bottle preview fragment.
 */
function renderBottle(model) {
  return renderTemplate('warehouseWallBottle', {
    selectedClass: model.selected ? ' is-selected' : '',
    focusClass: model.focused ? ' is-find-focus' : '',
    dimmedClass: model.dimmed ? ' is-find-dimmed' : '',
    bottleSymbol: bottleSymbol(model.bottle, {selectable: true, selected: model.selected}),
  });
}

/**
 * Renders a bay using already-calculated geometry and inventory preview data.
 * @param {!Object} bay Prepared shelf view model.
 * @return {!RenderPlan} Shelf fragment.
 */
function renderShelf(bay) {
  const shelfClasses = [
    bay.focused && 'is-find-focus', bay.compact && 'warehouse-wall-bay--compact',
    bay.tiny && 'warehouse-wall-bay--tiny', bay.top && 'warehouse-wall-bay--top',
    bay.unavailable && 'warehouse-wall-bay--unavailable',
  ].filter(Boolean).map(name => ` ${name}`).join('');
  return renderTemplate('warehouseShelf', {
    shelfClasses,
    shelfId: safe(bay.shelfId), shelfCapacity: bay.shelfCapacity, shelfAction: bay.action,
    front: safe(bay.front), bayHeight: bay.bayHeight, bottleHeight: bay.bottleHeight,
    bottleWidth: bay.bottleWidth, name: safe(bay.shelfName), frontName: safe(bay.frontName),
    occupancy: bay.occupancy ? ` · ${safe(bay.occupancy)}` : '',
    preview: composeMarkup(bay.bottles.map(renderBottle)),
    warehouseShelfOverflow: bay.hiddenCount ? renderTemplate('warehouseShelfOverflow', {
      ariaLabel: safe(t('warehouse.shelves.moreBottles', {count: bay.hiddenCount})), hiddenCount: bay.hiddenCount,
    }) : '',
    content: bay.empty ? (bay.unavailable ? renderTemplate('warehouseWallNoSpace') : renderTemplate('hint')) : '',
  });
}

/**
 * Renders one furniture front and its prepared shelves.
 * @param {!Object} item Prepared furniture view model.
 * @param {boolean} stacked Whether the furniture shares a stack.
 * @return {!RenderPlan} Furniture fragment.
 */
function renderFurniture(item, stacked) {
  return renderTemplate('warehouseWallFurniture', {
    stacked: stacked ? ' warehouse-wall-furniture--stacked' : '',
    furnitureId: safe(item.id), widthPx: item.widthPx, heightPx: item.heightPx,
    elevationPx: item.elevationPx, offsetPx: item.offsetPx,
    clearance: item.clearanceCm > 0.001 ? renderTemplate('warehouseWallClearance', {
      clearancePx: item.clearancePx,
      title: safe(t('warehouse.shelves.remainingHeight', {height: num(item.clearanceCm)})),
    }) : '',
    bays: composeMarkup(item.bays.map(renderShelf)),
    editFurniture: renderTemplate('warehouseFurnitureManage', {
      id: safe(item.id), title: safe(item.name),
      ariaLabel: safe(t('warehouse.shelves.showForFurniture', {name: item.name})),
    }),
  });
}

/**
 * Renders the room wall, preserving selection and the unassigned tray.
 * @param {!Object} room Current room.
 * @param {!Object} warehouse Current warehouse inventory.
 * @param {!Array<string>=} selectedBottleIds Selected inventory IDs.
 * @param {!Object=} unassignedOptions Search focus and tray configuration.
 * @return {!RenderPlan} Complete wall fragment.
 */
export function renderWarehouseRoomWall(room, warehouse, selectedBottleIds = [], unassignedOptions = {}) {
  const model = createWarehouseWallViewModel(room, warehouse, selectedBottleIds, unassignedOptions);
  const cards = composeMarkup(model.groups.map(group => renderTemplate('warehouseWallStack', {
    layeredClass: group.layered ? ' warehouse-wall-stack--layered' : '',
    directionClass: group.changeWall ? ' warehouse-wall-stack--new-direction' : '',
    orientation: group.orientation, widthPx: group.widthPx, heightPx: group.heightPx,
    furnitureHtml: composeMarkup(group.furniture.map(item => renderFurniture(item, group.layered))),
  })));
  return renderTemplate('warehouseRoomWall', {
    focusClass: model.focused ? ' has-find-focus' : '',
    ariaLabel: safe(t('warehouse.wall.aria', {room: model.roomName})),
    bulkToolsLabel: safe(t('warehouse.bottles.bulkTools')),
    bulkSelected: safe(t('warehouse.bottles.bulkSelected', {count: model.selectedCount})),
    expanded: String(model.expanded), title: safe(t('warehouse.wall.unassignedToggleHint')),
    unassignedTitle: t('warehouse.wall.unassignedTitle', {count: model.unassignedCount}),
    disabledAttributes: {disabled: !model.selectedCount},
    previewAttributes: {disabled: model.selectedCount !== 1},
    assignAttributes: {disabled: !model.selectedCount},
    unassignedTray: renderUnassignedTray(warehouse, selectedBottleIds, {...unassignedOptions, embedded: true}),
    warehouseWallScroll: model.groups.length ? renderTemplate('warehouseWallScroll', {
      roomId: safe(model.roomId), ariaLabel: safe(t('warehouse.wall.scrollAria')), cards,
    }) : renderTemplate('warehouseRoomWallEmpty'),
  });
}
