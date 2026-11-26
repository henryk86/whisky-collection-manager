/** @fileoverview Physical geometry and presentation state for the storage wall. */
import {furnitureHeight, shelfLevels, visibleShelfFront} from '../../../../shared/warehouse-compartments.js';
import {wallFurnitureGroups} from '../../domain/warehouse-wall-layout.js';
import {unassignedWallPage} from '../../domain/warehouse-unassigned-tray.js';
import {t} from '../../i18n/index.js';

/** Shared scale, independent of furniture orientation. */
export const WALL_PIXELS_PER_METRE = 230;

/**
 * Converts physical metres to screen pixels without accumulating rounding errors.
 * @param {number} metres Physical length.
 * @return {number} Pixel length at the wall scale.
 */
function pixels(metres) {
  return Math.round(metres * WALL_PIXELS_PER_METRE * 100) / 100;
}

/**
 * Groups occupants by their assigned compartment while retaining inventory order.
 * @param {!Object} warehouse Current warehouse inventory.
 * @return {!Map<string, !Array<!Object>>} Occupants indexed by shelf ID.
 */
function occupantsByShelf(warehouse) {
  const occupants = new Map();
  for (const bottle of warehouse.bottles || []) {
    const shelfId = warehouse.assignments?.[bottle.id];
    if (!shelfId) continue;
    if (!occupants.has(shelfId)) occupants.set(shelfId, []);
    occupants.get(shelfId).push(bottle);
  }
  return occupants;
}

/**
 * Calculates a bay's real dimensions, bottle preview and interaction state.
 * Physical shelf dimensions never change to accommodate inventory or overflow.
 * @param {!Object} item Furniture record.
 * @param {!Object} level Physical shelf level.
 * @param {number} index Top-to-bottom display index.
 * @param {number} widthPx Width of the furniture in pixels.
 * @param {!Array<!Object>} occupants Assigned bottles.
 * @param {!Set<string>} selected Selected bottle IDs.
 * @param {?string} focusedBottleId Bottle found by the inventory search.
 * @return {!Object} Prepared bay and bottle data.
 */
function shelfModel(item, level, index, widthPx, occupants, selected, focusedBottleId) {
  const shelf = level.shelf;
  const front = visibleShelfFront(item, level.index);
  const frontName = t({
    open: 'warehouse.front.open', door: 'warehouse.front.woodDoor',
    glass: 'warehouse.front.glassDoor', drawer: 'warehouse.front.drawer',
  }[front] || 'warehouse.front.open');
  const bayHeight = pixels(level.heightCm / 100);
  const compact = bayHeight < 52;
  const tiny = bayHeight < 30;
  // Reserve the label, rail, padding and shelf board before sizing photos.
  const titleHeight = tiny ? 0 : compact ? 12 : 24;
  const topPadding = index === 0 && !tiny ? 8 : tiny ? 1 : 3;
  const bottleHeight = Math.max(1, Math.min(72, bayHeight - titleHeight - topPadding - 4 - 5 - 2));
  const bottleWidth = Math.max(10, Math.round(Math.min(bottleHeight * .6, Math.max(12, Math.min(27, widthPx / 5.6)))));
  const occupancy = shelf.capacity === 0 ? '' : shelf.capacity === null ? `${occupants.length}` : `${occupants.length} / ${shelf.capacity}`;
  // Cabinet uprights and bay padding consume 22px. Reserve another 27px
  // for the overflow badge instead of covering the final bottle.
  const rowWidth = Math.max(0, widthPx - 22);
  const maxPreview = Math.min(5, Math.max(1, Math.floor((rowWidth + 2) / (bottleWidth + 2))));
  const previewCount = occupants.length > maxPreview ? Math.max(1, Math.min(maxPreview, Math.floor((rowWidth - 27) / (bottleWidth + 2)))) : maxPreview;
  const preview = occupants.slice(0, previewCount);
  const focusedBottle = focusedBottleId && occupants.find(b => b.id === focusedBottleId);
  const focused = !!focusedBottle;
  if (previewCount && focused && !preview.some(b => b.id === focusedBottleId)) {
    preview[preview.length - 1] = focusedBottle;
  }
  const shelfName = `${item.name} / ${shelf.name}`;
  const hint = t('warehouse.shelves.doubleClickHint');
  return {
    shelfId: shelf.id, shelfName: shelf.name, shelfCapacity: shelf.capacity ?? 'unlimited',
    front, frontName, occupancy, bayHeight, bottleHeight, bottleWidth,
    focused, compact, tiny, top: index === 0, unavailable: shelf.capacity === 0,
    action: shelf.capacity === 0 ? {} : {
      'data-act': 'warehouse-shelf-view', tabindex: '0', role: 'button',
      'aria-label': `${shelfName} — ${hint}`,
      title: `${shelfName} · ${frontName}${occupancy ? ` · ${occupancy}` : ''} · ${hint}`,
    },
    bottles: preview.map(bottle => ({
      bottle, selected: selected.has(bottle.id), focused: bottle.id === focusedBottleId,
      dimmed: focused && bottle.id !== focusedBottleId,
    })),
    hiddenCount: occupants.length - preview.length,
    empty: occupants.length === 0,
  };
}

/**
 * Prepares furniture dimensions and shelves in physical top-to-bottom order.
 * @param {!Object} entry Wall layout entry.
 * @param {!Map<string, !Array<!Object>>} occupants Shelf occupant index.
 * @param {!Set<string>} selected Selected bottle IDs.
 * @param {?string} focusedBottleId Search result bottle.
 * @return {!Object} Furniture presentation data.
 */
function furnitureModel(entry, occupants, selected, focusedBottleId) {
  const item = entry.furniture;
  const levels = shelfLevels(item);
  const height = furnitureHeight(item);
  const widthPx = pixels(Number(item.width ?? 1));
  const clearanceCm = Math.max(0, height * 100 - levels.reduce((sum, level) => sum + level.heightCm, 0));
  return {
    id: item.id, name: item.name, widthPx, heightPx: pixels(height),
    elevationPx: pixels(Number(item.elevation ?? 0)), offsetPx: pixels(entry.offset),
    clearanceCm, clearancePx: pixels(clearanceCm / 100),
    bays: levels.slice().reverse().map((level, index) => shelfModel(item, level, index, widthPx,
      occupants.get(level.shelf.id) || [], selected, focusedBottleId)),
  };
}

/**
 * Builds the complete room-wall presentation without rendering or mutation.
 * @param {!Object} room Current room.
 * @param {!Object} warehouse Current inventory.
 * @param {!Array<string>} selectedBottleIds Selected inventory IDs.
 * @param {!Object} options Search focus and unassigned tray state.
 * @return {!Object} Room label, grouped furniture, selection and tray data.
 */
export function createWarehouseWallViewModel(room, warehouse, selectedBottleIds, options) {
  const selected = new Set(selectedBottleIds);
  const focusedBottleId = options.focusBottleId || null;
  const occupants = occupantsByShelf(warehouse);
  const groups = wallFurnitureGroups(room);
  return {
    roomId: room.id, roomName: room.name, focused: !!focusedBottleId,
    selectedCount: selected.size, expanded: !!options.expanded,
    unassignedCount: unassignedWallPage(warehouse).total,
    groups: groups.map((group, index) => ({
      orientation: group.orientation, widthPx: pixels(group.width), heightPx: pixels(group.height),
      layered: group.items.length > 1,
      changeWall: index > 0 && groups[index - 1].orientation !== group.orientation,
      furniture: group.items.map(entry => furnitureModel(entry, occupants, selected, focusedBottleId)),
    })),
  };
}
