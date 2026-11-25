import {shelfLevels, visibleShelfFront, doorRangeForIndex, furnitureHeight} from '../../../../shared/warehouse-compartments.js';
import {storagePath} from '../../domain/warehouse-storage-path.js';
import {displayedTastingRating} from '../../../../shared/tasting-records.js';
import {t, formatNumber} from '../../i18n/index.js';

/**
 * Prepares the scaled floor-plan geometry and occupancy independently of SVG.
 * @param {!Object} room Physical room dimensions and furniture.
 * @param {!Object} warehouse Storage assignments and focused furniture.
 * @param {string=} layer Visible elevation layer.
 * @return {!Object} ViewBox, grid lines and ordered furniture geometry.
 */
export function createRoomDiagramModel(room, warehouse, layer = 'all') {
  const vbW = 600;
  const vbH = Math.max(220, Math.round(600 * room.height / room.width));
  const sx = vbW / room.width, sy = vbH / room.height;
  const gridLines = [];
  // Integer decimetres avoid floating-point errors at the 0.1 m boundaries.
  for (const [metres, scale, vertical] of [[room.width, sx, true], [room.height, sy, false]]) {
    const divisions = Math.floor(metres * 10 + 1e-8);
    for (let index = 1; index < divisions; index++) {
      gridLines.push({vertical, position: index / 10 * scale, level: index % 10 === 0 ? 'major' : index % 5 === 0 ? 'minor' : 'fine'});
    }
  }
  const counts = new Map();
  for (const id of Object.values(warehouse.assignments)) counts.set(id, (counts.get(id) || 0) + 1);
  const items = room.furniture.filter(f => layer === 'all' || (layer === 'floor' ? (f.elevation ?? 0) === 0 : (f.elevation ?? 0) > 0))
    .sort((a, b) => (a.elevation ?? 0) - (b.elevation ?? 0));
  const shapes = items.map(f => {
    const fw = (f.rotation % 180 === 0 ? f.width : f.depth) * sx;
    const fh = (f.rotation % 180 === 0 ? f.depth : f.width) * sy;
    const x = f.x * sx, y = f.y * sy;
    return {
      furniture: f, elevated: (f.elevation ?? 0) > 0, focused: warehouse.focusFurnitureId === f.id,
      x: x + 1, y: y + 1, width: Math.max(2, fw - 2), height: Math.max(2, fh - 2),
      nameX: x + fw / 2, nameY: y + fh / 2 - 4, detailsY: y + fh / 2 + 13,
      assigned: f.shelves.reduce((sum, shelf) => sum + (counts.get(shelf.id) || 0), 0),
    };
  });
  return {vbW, vbH, gridLines, shapes};
}

/**
 * Prepares management rows for a cabinet, including door ranges and overflow.
 * @param {!Object} warehouse Storage inventory and assignments.
 * @param {!Object} furniture Cabinet with physical shelf levels.
 * @return {!Object} Shelf rows, dimensions and remaining height.
 */
export function createShelfPanelModel(warehouse, furniture) {
  const levels = shelfLevels(furniture);
  const rows = levels.slice().reverse().map(level => {
    const shelf = level.shelf;
    const i = level.index;
    const occupants = warehouse.bottles.filter(b => warehouse.assignments[b.id] === shelf.id);
    const range = doorRangeForIndex(furniture, i);
    const doorFront = range?.front || level.front;
    const doorLeaves = range?.doorLeaves ?? shelf.doorLeaves ?? furniture.doorLeaves ?? (doorFront === 'glass' ? 1 : 2);
    const framed = range?.glassFrame ?? shelf.glassFrame ?? furniture.glassFrame;
    return {
      shelf, front: visibleShelfFront(furniture, i), height: level.heightCm, range, doorFront, doorLeaves, framed,
      occupied: occupants.length, occupants: occupants.slice(0, 6), overflow: Math.max(0, occupants.length - 6),
      canMoveUp: i !== furniture.shelves.length - 1, canMoveDown: i !== 0,
    };
  });
  const height = furnitureHeight(furniture);
  const used = levels.reduce((sum, entry) => sum + entry.height, 0);
  return {rows, height, topSpace: Math.max(0, Math.round((height - used) * 100))};
}

/**
 * Builds the stable inventory label used by shelf ordering and bottle previews.
 * @param {!Object} bottle Warehouse bottle record.
 * @return {string} Inventory number, name and optional sample marker.
 */
export function warehouseBottleLabel(bottle) {
  return `${bottle.number ? '#' + bottle.number + ' · ' : ''}${bottle.name}${bottle.volumeType === 'sample' ? ' · Sample' : ''}`;
}

/**
 * Finds a shelf and prepares its ordered bottle facts from inventory and collection.
 * @param {!Object} warehouse Warehouse inventory.
 * @param {string} shelfId Compartment identifier.
 * @param {!Array<!Object>=} bottlings Current bottling records.
 * @return {?Object} Shelf details, unavailable marker or null.
 */
export function createShelfContentsModel(warehouse, shelfId, bottlings = []) {
  const place = storagePath(warehouse, shelfId);
  if (!place) return null;
  if (place.shelf.capacity === 0) return {unavailable: true};
  const bottlingById = new Map((bottlings || []).map(bottling => [bottling.id, bottling]));
  const rows = (warehouse.bottles || []).filter(b => warehouse.assignments?.[b.id] === shelfId)
    .sort((a, b) => warehouseBottleLabel(a).localeCompare(warehouseBottleLabel(b), undefined, {numeric: true}))
    .map(bottle => ({bottle, abv: bottlingById.get(bottle.bottlingId)?.abv}));
  return {title: place.label, rows, count: rows.length};
}

/**
 * Prepares the available bottle facts without inserting fallback data for missing fields.
 * @param {!Object} w Warehouse inventory.
 * @param {!Object} bottle Warehouse bottle.
 * @param {?Object} bottling Associated bottling.
 * @param {?Object} physicalBottle Collection bottle record.
 * @return {!Array<!Array<*>>} Localized label/value pairs.
 */
export function createBottlePreviewFacts(w, bottle, bottling, physicalBottle) {
  const statusKey = {
    closed: 'home.status.closed',
    open: 'analytics.inventory.openedStatus',
    empty: 'home.status.empty',
  }[bottle.status];
  return [
    [
      t('forms.bottle.inventoryNumber'),
      bottle.number || t('imports.bottles.noInventoryNumber'),
    ],
    [t('forms.bottle.statusLabel'), statusKey ? t(statusKey) : null],
    [
      t('forms.bottle.type'),
      t(bottle.volumeType === 'sample' ? 'forms.bottle.sampleBottle' : 'forms.bottle.normalBottle'),
    ],
    [
      t('warehouse.bottles.volume'),
      bottle.volumeMl == null ? null : `${formatNumber(bottle.volumeMl)} ml`,
    ],
    [
      t('detail.fields.storageLocation'),
      storagePath(w, w.assignments[bottle.id])?.label || t('detail.fields.unassigned'),
    ],
    [
      t('forms.bottling.ageYears'),
      bottling?.ageYears == null ? null : t('home.facts.years', {count: bottling.ageYears}),
    ],
    [t('forms.bottling.releaseYear'), bottling?.releaseYear ?? null],
    [t('forms.bottling.caskType'), bottling?.caskType || null],
    [
      t('forms.bottling.abv'),
      bottling?.abv == null ? null : `${formatNumber(bottling.abv)} % Vol.`,
    ],
    [t('forms.bottle.purchaseDate'), physicalBottle?.purchaseDate],
    [t('forms.bottle.openingDate'), physicalBottle?.openedAt],
    [t('forms.bottle.emptyDate'), physicalBottle?.emptiedAt],
    [
      t('forms.bottle.purchasePrice'),
      physicalBottle?.purchasePrice == null ? null :
        `${formatNumber(physicalBottle.purchasePrice)} ${physicalBottle.currency || 'EUR'}`,
    ],
    [t('forms.bottle.seller'), physicalBottle?.merchant],
    [t('forms.bottle.rating'), displayedTastingRating(bottling)],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
}
