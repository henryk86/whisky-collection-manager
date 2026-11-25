import {composeMarkup} from '../ui/render-plan.js';
import {displayedTastingRating} from '../../../shared/tasting-records.js';
/** Warehouse presentation helpers: pure HTML/SVG fragments and display labels.
 * No API writes, navigation or modal state. The controller is in warehouse.js.
 */
import {addActionLabel, arrowUpIcon, arrowDownIcon, closeIcon}
  from '../ui/action-icons.js';
import {escapeHtml as esc} from '../ui/dom.js';
import {imageUrl} from '../ui/format.js';
import {routeUrl} from '../navigation/routes.js';
import {t, formatNumber} from '../i18n/index.js';
import {
  shelfLevels, effectiveShelfFront, visibleShelfFront, doorRangeForIndex,
  furnitureHeight
} from '../../../shared/warehouse-compartments.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates(new URL('./templates/warehouse-presentation.html', import.meta.url));


// Stable semantic keys, explicitly mapped from persisted domain codes.
// Never construct a translation key from a translated display label.
const FURNITURE_TYPE_KEYS = Object.freeze({
  regal: 'warehouse.furniture.types.shelf',
  vitrine: 'warehouse.furniture.types.displayCabinet',
  schrank: 'warehouse.furniture.types.cabinet',
  kommode: 'warehouse.furniture.types.dresser',
  kiste: 'warehouse.furniture.types.crate',
  haengeregal: 'warehouse.furniture.types.wallShelf',
  sonstiges: 'warehouse.furniture.types.other',
});
const FRONT_KEYS = Object.freeze({
  open: 'warehouse.front.open', door: 'warehouse.front.woodDoor',
  glass: 'warehouse.front.glassDoor', drawer: 'warehouse.front.drawer',
});
const CAMERA_KEYS = Object.freeze({
  nw: 'warehouse.camera.northwest', ne: 'warehouse.camera.northeast',
  se: 'warehouse.camera.southeast', sw: 'warehouse.camera.southwest',
});
const ROOM_SECTION_KEYS = Object.freeze({
  overview: 'warehouse.navigation.overview',
  rooms: 'warehouse.navigation.roomPlans',
  shelves: 'warehouse.navigation.shelves',
  find: 'warehouse.navigation.findBottles',
});
const TYPES = Object.keys(FURNITURE_TYPE_KEYS);
/**
 * Transforms the entries used by type choices.
 * @return {!Array<*>} Resulting entries in their output order.
 */
const typeChoices = () => TYPES.map(type => [type, t(FURNITURE_TYPE_KEYS[type])]);

/**
 * Derives the type name result from the supplied values.
 *
 * @param {*} type Type or category used to select behavior.
 * @return {*} Whether the requested condition is met.
 */
const typeName = type => TYPES.includes(type) ? t(FURNITURE_TYPE_KEYS[type]) : type;

/**
 * Derives the num result from the supplied values.
 *
 * @param {*} value Value to process.
 * @return {string} Resulting text.
 */
const num = value => formatNumber(Number(value), {maximumFractionDigits: 2});

/**
 * Builds the localized capacity label text for the current language.
 *
 * @param {*} s Source value to transform.
 * @return {*} Result computed from the supplied inputs.
 */
const capacityLabel = s => s.shelves === 0 ?
  t('warehouse.capacity.noShelves') : s.unlimited === 0 ?
    t('warehouse.capacity.defined', {count: s.defined}) : s.defined === 0 ?
      t('warehouse.capacity.onlyUnlimited', {count: s.unlimited}) : t('warehouse.capacity.partialUnlimited', {count: s.unlimited, places: s.defined});

/**
 * Derives the safe result from the supplied values.
 *
 * @param {*} value Value to process.
 * @return {string} Resulting text.
 */
const safe = value => esc(String(value ?? ''));

/**
 * Filters records according to the count selection rules.
 *
 * @param {*} w Width or value used by the calculation.
 * @param {*} shelfId Value used by this operation.
 * @return {number} Calculated numeric value.
 */
const count = (w, shelfId) => Object.values(w.assignments).filter(id => id === shelfId).length;

/**
 * Finds the room and shelf path for a stored bottle.
 *
 * @param {!Object} warehouse Warehouse model being processed.
 * @param {*} shelfId Shelf id used by this operation.
 * @return {?Object} Computed value, or null when the input has no match.
 */
export function storagePath(warehouse, shelfId) {
  for (const room of warehouse?.rooms || []) for (const furniture of room.furniture) for (const shelf of furniture.shelves) {
    if (shelf.id === shelfId) return {
      room,
      furniture,
      shelf,
      label: `${room.name} / ${furniture.name} / ${shelf.name}`,
    };
  }
  return null;
}

/**
 * Produces the field text used by the caller.
 *
 * @param {*} name Environment variable or setting name.
 * @param {*} label Label shown to the user.
 * @param {string=} value Value to process.
 * @param {string=} type Type or category used to select behavior.
 * @param {string=} options Options controlling the operation.
 * @return {string} Resulting text.
 */
function field(name, label, value = '', type = 'text', options = '') {
  return renderTemplate('formField', {
    label: label,
    name: name,
    type: type,
    options: options,
    safe: safe(value),
  });
}

/**
 * Transforms the entries used by choices.
 *
 * @param {*} name Environment variable or setting name.
 * @param {*} label Label shown to the user.
 * @param {*} options Options controlling the operation.
 * @param {string=} chosen Value used by this operation.
 * @return {string} Resulting text.
 */
function choices(name, label, options, chosen = '') {
  return renderTemplate('formField2', {
    label: label,
    name: name,
    options: composeMarkup(options.map(([id,
      title]) => renderTemplate('choicesOption', {
        safe: safe(id),
        selected: id === chosen ? 'selected' : '',
        title: title,
      }))),
  });
}

/**
 * Builds the localized footer text for the current language.
 * @return {string} Resulting text.
 */
function footer() {
  return renderTemplate('closeModal');
}

/**
 * Produces the bottle label text used by the caller.
 *
 * @param {*} b Second entry or operand in the calculation.
 * @return {string} Resulting text.
 */
function bottleLabel(b) {
  return `${b.number ? '#' + b.number + ' · ' : ''}${b.name}${b.volumeType === 'sample' ? ' · Sample' : ''}`;
}

/**
 * Read-only bottling facts; missing values are never synthesized.
 *
 * @param {!Object} bottle Physical bottle record being processed.
 * @return {string} Resulting text.
 */
function bottleListFacts(bottle) {
  const facts = [
    [
      'forms.bottling.ageYears',
      bottle.ageYears == null || bottle.ageYears === '' ? null : t('home.facts.years', {count: bottle.ageYears}),
    ],
    [
      'forms.bottling.releaseYear',
      bottle.releaseYear == null || bottle.releaseYear === '' ? null : bottle.releaseYear,
    ],
    [
      'forms.bottling.caskType',
      bottle.caskType == null || String(bottle.caskType).trim() === '' ? null : bottle.caskType,
    ],
  ];
  return composeMarkup(facts.filter(([, value]) => value !== null).map(([key, value]) =>
    renderTemplate('warehouseBottleFact', {
      safe: safe(t(key)),
      safe2: safe(value),
    })));
}

/**
 * Filters records according to the bottle row selection rules.
 *
 * @param {*} w Width or value used by the calculation.
 * @param {*} bottle Physical bottle record under consideration.
 * @param {boolean=} selected Currently selected item or identifier.
 * @return {string} Resulting text.
 */
function bottleRow(w, bottle, selected = false) {
  const place = storagePath(w, w.assignments[bottle.id]);
  const facts = bottleListFacts(bottle);
  const searchable = [
    bottleLabel(bottle),
    place?.label,
    bottle.ageYears,
    bottle.releaseYear,
    bottle.caskType,
  ]
    .filter(value => value != null).join(' ').toLocaleLowerCase('de');
  return renderTemplate('warehouseBottleRow', {
    safe: safe(searchable),
    safe2: safe(bottle.id),
    safe3: safe(t('warehouse.bottles.bulkSelectOne', {name: bottle.name})),
    checked: selected ? 'checked' : '',
    safe4: safe(bottleLabel(bottle)),
    place: place ? safe(place.label) : t("detail.fields.unassigned"),
    warehouseBottleFacts: facts ? renderTemplate('warehouseBottleFacts', {facts: facts, }) : '',
    safe5: safe(bottle.id),
    place2: place ? t("warehouse.bottles.relocate") : t("warehouse.bottles.assignAction"),
  });
}

/**
 * Derives the room options result from the supplied values.
 *
 * @param {*} w Width or value used by the calculation.
 * @param {*} roomId Value used by this operation.
 * @return {*} Result computed from the supplied inputs.
 */
function roomOptions(w, roomId) {
  return w.rooms.find(room => room.id === roomId);
}

/**
 * Selects furniture matching the input.
 *
 * @param {*} w Width or value used by the calculation.
 * @param {*} furnitureId Value used by this operation.
 * @return {!Object} Computed value, or null when the input has no match.
 */
function findFurniture(w, furnitureId) {
  for (const room of w.rooms) {
    const furniture = room.furniture.find(f => f.id === furnitureId); if (furniture) return {room, furniture};
  }
  return null;
}

/**
 * Selects and transforms the room diagram records.
 *
 * @param {*} room Warehouse room being inspected or modified.
 * @param {*} w Width or value used by the calculation.
 * @param {string=} layer Value used by this operation.
 * @return {string} Resulting text.
 */
function roomDiagram(room, w, layer = 'all') {
  // SVG coordinates are metres scaled to the viewBox. Drawing remains useful
  // without JavaScript drag.
  const vbW = 600, vbH = Math.max(220, Math.round(600 * room.height / room.width));
  const sx = vbW / room.width, sy = vbH / room.height;
  // 10 cm subdivisions, 50 cm guide lines and emphasized full metres.
  // Integer decimetres avoid floating-point errors at 0.1 m boundaries.
  const gridLines = [];
  /**
   * Constructs grid from the supplied data.
   *
   * @param {*} metres Value used by this operation.
   * @param {*} scale Value used by this operation.
   * @param {*} vertical Value used by this operation.
   */
  const makeGrid = (metres, scale, vertical) => {
    const divisions = Math.floor(metres * 10 + 1e-8);
    for (let index = 1; index < divisions; index++) {
      const position = (index / 10) * scale;
      const level = index % 10 === 0 ? 'major' : index % 5 === 0 ? 'minor' : 'fine';
      gridLines.push(vertical
        ? renderTemplate('warehouseGrid', {
          level: level,
          position: position,
          position2: position,
          vbH: vbH,
        })
        : renderTemplate('warehouseGrid2', {
          level: level,
          position: position,
          vbW: vbW,
          position2: position,
        }));
    }
  };
  makeGrid(room.width, sx, true);
  makeGrid(room.height, sy, false);
  const grid = renderTemplate('warehousePlanGrid', {gridLines: composeMarkup(gridLines), });
  const items = room.furniture.filter(f => layer === 'all' || (layer === 'floor' ? (f.elevation ?? 0) === 0 : (f.elevation ?? 0) > 0))
    .slice().sort((a, b) => (a.elevation ?? 0) - (b.elevation ?? 0));
  const shapes = composeMarkup(items.map((f, i) => {
    const fw = (f.rotation % 180 === 0 ? f.width : f.depth) * sx;
    const fh = (f.rotation % 180 === 0 ? f.depth : f.width) * sy;
    const x = f.x * sx, y = f.y * sy;
    const assigned = f.shelves.reduce((s, shelf) => s + count(w, shelf.id), 0);
    return renderTemplate('warehouseDrag', {
      elevation: (f.elevation ?? 0) > 0 ? 'warehouse-elevated' : 'warehouse-floor-level',
      focusFurnitureId: w.focusFurnitureId === f.id ? 'warehouse-selected' : '',
      safe: safe(f.id),
      safe2: safe(t("warehouse.view.furnitureKeyboardHint", {name: f.name})),
      x: x + 1,
      y: y + 1,
      max: Math.max(2, fw - 2),
      max2: Math.max(2, fh - 2),
      x2: x + fw / 2,
      y2: y + fh / 2 - 4,
      safe3: safe(f.name.slice(0, 19)),
      x3: x + fw / 2,
      y3: y + fh / 2 + 13,
      elevation2: (f.elevation ?? 0) > 0 ? `${t("warehouse.view.fromElevation", {height: num(f.elevation)})} · ` : '',
      abbreviatedBottleCount: t("warehouse.view.abbreviatedBottleCount", {count: assigned}),
    });
  }));
  return renderTemplate('warehouseMapWrap', {
    vbW: vbW,
    vbH: vbH,
    safe: safe(room.id),
    safe2: safe(t("warehouse.view.roomPlanAria", {name: room.name})),
    vbW2: vbW - 2,
    vbH2: vbH - 2,
    grid: grid,
    shapes: shapes,
    vbH3: vbH - 9,
  });
}

/**
 * Builds the localized bottle symbol text for the current language.
 *
 * @param {*} b Second entry or operand in the calculation.
 * @param {!Object=} options Options controlling the operation.
 * @return {string} Resulting text.
 */
function bottleSymbol(
  b,
  {
    selectable = false,
    selected = false,
    placeholderImage = false,
    staticImage = false
  } = {}
) {
  // Shelf detail cards reuse the same missing-photo icon as the collection
  // overview.
  // Small shelf/wall silhouettes remain unchanged so their layout is
  // unaffected.
  const showPlaceholder = placeholderImage && !b.photoPath;
  const photo = b.photoPath ?
    renderTemplate('warehouseBottlePhoto', {safe: safe(imageUrl(b.photoPath)), })
    : showPlaceholder ? renderTemplate('warehouseBottlePhoto2') : '';
  // In the shelf content dialog the picture is decorative. Selection and
  // relocation are intentionally handled outside this picture (actions below).
  const content = renderTemplate('warehouseLabel', {photo: photo, });
  if (staticImage) {
    return renderTemplate('warehouseBottleSymbol', {
      showPlaceholder: showPlaceholder ? ' has-photo' : '',
      content: content,
    });
  }
  const action = selectable ? 'warehouse-bottle-select' : 'warehouse-bottle-preview';
  const selectLabel = t('warehouse.bottles.bulkSelectOne', {name: bottleLabel(b), });
  const deselectLabel = t('warehouse.bottles.bulkDeselectOne', {name: bottleLabel(b)});
  const accessible = selectable ? (selected ? deselectLabel : selectLabel)
    : t('warehouse.bottles.openDetailsNamed', {name: bottleLabel(b)});
  return renderTemplate('warehouseBottleSymbol2', {
    showPlaceholder: showPlaceholder ? ' has-photo' : '',
    action: action,
    safe: safe(b.id),
    selectable: selectable ?
      `aria-pressed="${selected}" data-select-label="${safe(selectLabel)}" data-deselect-label="${safe(deselectLabel)}"` :
      '',
    safe2: safe(accessible),
    safe3: safe(accessible),
    content: content,
  });
}

/**
 * Reused actions for the shelf cards and an unassigned bottle preview. The
 * detail link retains the physical-bottle highlight on the destination page.
 *
 * @param {!Object} bottle Physical bottle record being processed.
 * @param {!Object=} options2 Destructured options for this operation.
 * @return {string} Resulting text.
 */
function bottleActionButtons(bottle, {detailLabelKey =
  'warehouse.bottles.goToDetails'} = {}) {
  const detailsLink = bottle.bottlingId
    ? renderTemplate('primaryButton', {
      safe: safe(routeUrl('detail', bottle.bottlingId)),
      safe2: safe(bottle.bottlingId),
      safe3: safe(bottle.id),
      t: t(detailLabelKey),
    })
    : '';
  return renderTemplate('warehouseAssign', {
    safe: safe(bottle.id),
    detailsLink: detailsLink,
  });
}

/**
 * Read-only summary for an unassigned bottle (a compartment has none to show).
 *
 * @param {*} w W used by this operation.
 * @param {!Object} bottle Physical bottle record being processed.
 * @param {!Object} bottling Bottling record being processed.
 * @param {*} physicalBottle Physical bottle used by this operation.
 * @return {string} Resulting text.
 */
function bottlePreview(w, bottle, bottling, physicalBottle) {
  const statusKey = {
    closed: 'home.status.closed',
    open: 'analytics.inventory.openedStatus',
    empty: 'home.status.empty',
  }[bottle.status];
  const fields = [
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
  const photo = bottle.photoPath
    ? renderTemplate('img', {
      safe: safe(imageUrl(bottle.photoPath)),
      safe2: safe(bottle.name),
    })
    : renderTemplate('img2');
  return renderTemplate('warehouseBottlePreview', {
    photo: photo,
    safe: safe(bottle.name),
    fields: composeMarkup(fields.map(([label,
      value]) => renderTemplate('bottlePreviewDiv', {
        safe: safe(label),
        safe2: safe(value),
      }))),
    warehouseBottlePreviewComment: physicalBottle?.comment ?
      renderTemplate('warehouseBottlePreviewComment', {safe: safe(physicalBottle.comment), }) : '',
    bottleActionButtons: bottleActionButtons(bottle, {detailLabelKey: 'warehouse.bottles.goToBottleDetails'}),
  });
}

/**
 * Selects and transforms the shelf panel records.
 *
 * @param {*} w Width or value used by the calculation.
 * @param {*} room Warehouse room being inspected or modified.
 * @param {*} furniture Warehouse furniture record being modified.
 * @param {!Object=} options Options controlling the operation.
 * @return {string} Resulting text.
 */
function shelfPanel(w, room, furniture, {managementOnly = false} = {}) {
  const levels = shelfLevels(furniture);
  const shelves = composeMarkup(levels.slice().reverse().map(level => {
    const shelf = level.shelf;
    const i = level.index;
    const occupants = w.bottles.filter(b => w.assignments[b.id] === shelf.id);
    const range = doorRangeForIndex(furniture, i);
    const front = t(FRONT_KEYS[visibleShelfFront(furniture, i)]);
    const height = level.heightCm;
    const doorLabel = ['door', 'glass'].includes(range?.front || level.front) ? ` · ${(range?.doorLeaves ?? shelf.doorLeaves ?? furniture.doorLeaves ?? ((range?.front || level.front) === 'glass' ? 1 : 2)) === 1 ? t("warehouse.doors.singleLeaf") :
      t("warehouse.doors.doubleLeaf")}${(range?.front || level.front) === 'glass' ? ((range?.glassFrame ?? shelf.glassFrame ?? furniture.glassFrame) ? ` · ${t('warehouse.walls.withFrame').replace(/^./, ch => ch.toLowerCase())}` : ` · ${t('warehouse.walls.withoutFrame').replace(/^./, ch => ch.toLowerCase())}`) : ''}${range ? ` · ${t("warehouse.shelves.doorAcross", {from: range.from, to: range.to})}` : ''}` : '';
    return renderTemplate('warehouseShelf', {
      safe: safe(shelf.id),
      capacity: shelf.capacity ?? 'unlimited',
      safe2: safe(shelf.name),
      safe3: safe(front),
      doorLabel: doorLabel,
      num: num(height),
      heightCm: shelf.heightCm == null ? ` ${t('warehouse.shelves.automaticHeight')}` : '',
      capacity2: shelf.capacity === 0 ? '' : ` · ${occupants.length}${shelf.capacity === null ? '' : ` / ${shelf.capacity}`} ${t("forms.bottle.plural")}`,
      safe4: safe(shelf.id),
      disabled: i === furniture.shelves.length - 1 ? 'disabled' : '',
      arrowUpIcon: arrowUpIcon,
      safe5: safe(shelf.id),
      disabled2: i === 0 ? 'disabled' : '',
      arrowDownIcon: arrowDownIcon,
      safe6: safe(shelf.id),
      safe7: safe(shelf.id),
      safe8: safe(shelf.id),
      occupants: composeMarkup(occupants.slice(0, 6).map(b => bottleSymbol(b))),
      warehouseShelfView: occupants.length > 6 ?
        renderTemplate('warehouseShelfView', {
          safe: safe(shelf.id),
          length: occupants.length - 6,
        }) : '',
      hint: !occupants.length && shelf.capacity !== 0 ? renderTemplate('hint') : '',
    });
  }));
  const height = furnitureHeight(furniture);
  const used = levels.reduce((sum, entry) => sum + entry.height, 0);
  const topSpace = Math.max(0, Math.round((height - used) * 100));
  return renderTemplate('panel', {
    safe: safe(furniture.name),
    safe2: safe(typeName(furniture.type)),
    sizeDescription: t(
      "warehouse.furniture.sizeDescription",
      {
        width: num(furniture.width),
        depth: num(furniture.depth),
        rotation: furniture.rotation,
        elevation: num(furniture.elevation ?? 0),
        height: num(height),
        shelves: furniture.shelves.length,
      }
    ),
    safe3: safe(furniture.id),
    safe4: safe(furniture.id),
    safe5: safe(furniture.id),
    hint: topSpace >= 1 ? renderTemplate('hint2', {remainingHeight: t("warehouse.shelves.remainingHeight", {height: num(topSpace)}), }) : '',
    managementOnly: managementOnly ? ' warehouse-shelves--management' : '',
    shelves: shelves || renderTemplate('hint3'),
    safe6: safe(furniture.id),
    addActionLabel: addActionLabel(t("warehouse.shelves.addWithPlus")),
    warehouseFurniturePhotos: managementOnly ?
      renderTemplate('warehouseFurniturePhotos', {
        photos: composeMarkup((furniture.photos || []).map((photo) =>
          renderTemplate('warehousePhotoOpen', {
            safe: safe(photo.path),
            safe2: safe(furniture.name),
            safe3: safe(photo.path),
            safe4: safe(furniture.name),
            safe5: safe(furniture.id),
            safe6: safe(photo.id),
            closeIcon: closeIcon,
          }))),
        addActionLabel: addActionLabel(t('warehouse.photos.add')),
        safe: safe(furniture.id),
        safe2: safe(furniture.id),
      }) : '',
  });
}


export {
  bottleSymbol, FRONT_KEYS, CAMERA_KEYS, ROOM_SECTION_KEYS, typeChoices,
  typeName, num, capacityLabel, safe, count, field, choices, footer,
  bottleLabel, bottleListFacts, bottleRow, bottlePreview,
  bottleActionButtons, roomOptions, findFurniture, roomDiagram, shelfPanel
};
