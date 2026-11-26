import {storagePath} from '../domain/warehouse-storage-path.js';
export {storagePath} from '../domain/warehouse-storage-path.js';
import {composeMarkup} from '../ui/render-plan.js';
import {createRoomDiagramModel, createShelfPanelModel, warehouseBottleLabel, createBottlePreviewFacts} from './models/warehouse-details.js';
/** Warehouse presentation helpers: pure HTML/SVG fragments and display labels.
 * No API writes, navigation or modal state. The controller is in warehouse.js.
 */
import {addActionLabel, arrowUpIcon, arrowDownIcon, closeIcon}
  from '../ui/action-icons.js';
import {imageUrl} from '../ui/format.js';
import {routeUrl} from '../navigation/routes.js';
import {t, formatNumber} from '../i18n/index.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates('warehouse/warehouse-presentation.html');


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
 * Resolves the localized display name of a warehouse furniture type.
 *
 * @param {*} type Type or category used to select behavior.
 * @return {*} Whether the requested condition is met.
 */
const typeName = type => TYPES.includes(type) ? t(FURNITURE_TYPE_KEYS[type]) : type;

/**
 * Formats a warehouse dimension for display.
 *
 * @param {*} value Value to process.
 * @return {string} Localized numeric value with at most two decimal places.
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
 * Filters records according to the count selection rules.
 *
 * @param {*} w Width or value used by the calculation.
 * @param {*} shelfId Identifier of the shelf whose assigned bottles are counted.
 * @return {number} Calculated numeric value.
 */
const count = (w, shelfId) => Object.values(w.assignments).filter(id => id === shelfId).length;

/**
 * Prepares labeled warehouse input with the supplied field options.
 *
 * @param {*} name Environment variable or setting name.
 * @param {*} label Label shown to the user.
 * @param {string=} value Value to process.
 * @param {string=} type Type or category used to select behavior.
 * @param {!Object=} options Additional input attributes.
 * @return {!import('../ui/render-plan.js').RenderPlan} Labeled warehouse input with the supplied field options.
 */
function field(name, label, value = '', type = 'text', options = {}) {
  return renderTemplate('formField', {
    label: label,
    name: name,
    type: type,
    options: options,
    value: String(value ?? ''),
  });
}

/**
 * Prepares labeled warehouse select with the current value selected.
 *
 * @param {*} name Environment variable or setting name.
 * @param {*} label Label shown to the user.
 * @param {*} options Options controlling the operation.
 * @param {string=} chosen Currently selected value in the generated option list.
 * @return {!import('../ui/render-plan.js').RenderPlan} Labeled warehouse select with the current value selected.
 */
function choices(name, label, options, chosen = '') {
  return renderTemplate('formField2', {
    label: label,
    name: name,
    options: composeMarkup(options.map(([id,
      title]) => renderTemplate('choicesOption', {
        value: String(id ?? ''),
        selectedAttributes: id === chosen ? {"selected": true} : {},
        title: title,
      }))),
  });
}

/**
 * Prepares dialog cancellation and save controls.
 * @return {!import('../ui/render-plan.js').RenderPlan} Dialog cancellation and save controls.
 */
function footer() {
  return renderTemplate('closeModal');
}

/**
 * Produces the bottle label text used by the caller.
 *
 * @param {*} b Second entry or operand in the calculation.
 * @return {string} Physical-bottle label containing inventory identifier, name and optional sample marker.
 */
function bottleLabel(b) {
  return warehouseBottleLabel(b);
}

/**
 * Read-only bottling facts; missing values are never synthesized.
 *
 * @param {!Object} bottle Physical bottle record being processed.
 * @return {import('../ui/render-plan.js').RenderPlan|string} Available bottling facts without invented metadata (or scalar/empty text when no plan is needed).
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
      factLabel: t(key),
      value: String(value ?? ''),
    })));
}

/**
 * Prepares searchable warehouse bottle row including placement and known facts.
 *
 * @param {*} w Width or value used by the calculation.
 * @param {*} bottle Physical bottle record under consideration.
 * @param {boolean=} selected Currently selected item or identifier.
 * @return {!import('../ui/render-plan.js').RenderPlan} Searchable warehouse bottle row including placement and known facts.
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
    bottleSearch: String(searchable ?? ''),
    id: String(bottle.id ?? ''),
    ariaLabel: t('warehouse.bottles.bulkSelectOne', {name: bottle.name}),
    checkedAttributes: selected ? {"checked": true} : {},
    bottleName: String((bottleLabel(bottle)) ?? ''),
    place: place ? String(place.label ?? '') : t("detail.fields.unassigned"),
    warehouseBottleFacts: facts ? renderTemplate('warehouseBottleFacts', {facts: facts, }) : '',
    locationBottleId: String(bottle.id ?? ''),
    assignmentLabel: place ? t("warehouse.bottles.relocate") : t("warehouse.bottles.assignAction"),
  });
}

/**
 * Resolves a room by identifier in the current warehouse.
 *
 * @param {*} w Width or value used by the calculation.
 * @param {*} roomId Identifier of the requested room.
 * @return {*} Result computed from the supplied inputs.
 */
function roomOptions(w, roomId) {
  return w.rooms.find(room => room.id === roomId);
}

/**
 * Selects furniture matching the input.
 *
 * @param {*} w Width or value used by the calculation.
 * @param {*} furnitureId Identifier of the furniture to locate across warehouse rooms.
 * @return {!Object} Computed value, or null when the input has no match.
 */
function findFurniture(w, furnitureId) {
  for (const room of w.rooms) {
    const furniture = room.furniture.find(f => f.id === furnitureId); if (furniture) return {room, furniture};
  }
  return null;
}

/**
 * Prepares scaled SVG room plan including its grid and furniture geometry.
 *
 * @param {*} room Warehouse room being inspected or modified.
 * @param {*} w Width or value used by the calculation.
 * @param {string=} layer Room-diagram layer to render, controlling which objects are displayed.
 * @return {!import('../ui/render-plan.js').RenderPlan} Scaled SVG room plan including its grid and furniture geometry.
 */
function roomDiagram(room, w, layer = 'all') {
  const {vbW, vbH, gridLines, shapes: geometry} = createRoomDiagramModel(room, w, layer);
  const grid = renderTemplate('warehousePlanGrid', {
    gridLines: composeMarkup(gridLines.map(({vertical, level, position}) => vertical
      ? renderTemplate('warehouseGrid', {level, position, endX: position, vbH})
      : renderTemplate('warehouseGrid2', {level, position, vbW, endY: position}))),
  });
  const shapes = composeMarkup(geometry.map(({furniture: f, elevated, focused, x, y, width, height, nameX, nameY, detailsY, assigned}) =>
    renderTemplate('warehouseDrag', {
      elevation: elevated ? 'warehouse-elevated' : 'warehouse-floor-level',
      focusFurnitureId: focused ? 'warehouse-selected' : '',
      id: String(f.id ?? ''),
      ariaLabel: t('warehouse.view.furnitureKeyboardHint', {name: f.name}),
      x, y, max: width, height, nameX, nameY,
      furnitureName: String((f.name.slice(0, 19)) ?? ''),
      detailsX: nameX, detailsY,
      elevationLabel: elevated ? `${t('warehouse.view.fromElevation', {height: num(f.elevation)})} · ` : '',
      abbreviatedBottleCount: t('warehouse.view.abbreviatedBottleCount', {count: assigned}),
    })));
  return renderTemplate('warehouseMapWrap', {
    vbW: vbW,
    vbH: vbH,
    roomId: String(room.id ?? ''),
    ariaLabel: t("warehouse.view.roomPlanAria", {name: room.name}),
    width: vbW - 2,
    height: vbH - 2,
    grid: grid,
    shapes: shapes,
    y: vbH - 9,
  });
}

/**
 * Prepares bottle silhouette or missing-photo symbol for the requested context.
 *
 * @param {*} b Second entry or operand in the calculation.
 * @param {!Object=} options Options controlling the operation.
 * @return {!import('../ui/render-plan.js').RenderPlan} Bottle silhouette or missing-photo symbol for the requested context.
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
    renderTemplate('warehouseBottlePhoto', {src: String((imageUrl(b.photoPath)) ?? ''), })
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
    id: String(b.id ?? ''),
    ariaPressedAttributes: selectable ? {"aria-pressed": selected, "data-select-label": selectLabel, "data-deselect-label": deselectLabel} : {},
    title: String(accessible ?? ''),
    ariaLabel: String(accessible ?? ''),
    content: content,
  });
}

/**
 * Reused actions for the shelf cards and an unassigned bottle preview. The
 * detail link retains the physical-bottle highlight on the destination page.
 *
 * @param {!Object} bottle Physical bottle record being processed.
 * @param {!Object=} options2 Destructured options for this operation.
 * @return {!import('../ui/render-plan.js').RenderPlan} Available detail and placement actions for a bottle.
 */
function bottleActionButtons(bottle, {detailLabelKey =
  'warehouse.bottles.goToDetails'} = {}) {
  const detailsLink = bottle.bottlingId
    ? renderTemplate('primaryButton', {
      href: String((routeUrl('detail', bottle.bottlingId)) ?? ''),
      id: String(bottle.bottlingId ?? ''),
      bottleId: String(bottle.id ?? ''),
      t: t(detailLabelKey),
    })
    : '';
  return renderTemplate('warehouseAssign', {
    id: String(bottle.id ?? ''),
    detailsLink: detailsLink,
  });
}

/**
 * Read-only summary for an unassigned bottle (a compartment has none to show).
 *
 * @param {*} w Warehouse state used to resolve the bottle's current storage location.
 * @param {!Object} bottle Physical bottle record being processed.
 * @param {!Object} bottling Bottling record being processed.
 * @param {*} physicalBottle Physical bottle metadata used for the detailed preview facts.
 * @return {!import('../ui/render-plan.js').RenderPlan} Read-only bottle preview with facts, photo and placement actions.
 */
function bottlePreview(w, bottle, bottling, physicalBottle) {
  const fields = createBottlePreviewFacts(w, bottle, bottling, physicalBottle);
  const photo = bottle.photoPath
    ? renderTemplate('img', {
      src: String((imageUrl(bottle.photoPath)) ?? ''),
      alt: String(bottle.name ?? ''),
    })
    : renderTemplate('img2');
  return renderTemplate('warehouseBottlePreview', {
    photo: photo,
    name: String(bottle.name ?? ''),
    fields: composeMarkup(fields.map(([label,
      value]) => renderTemplate('bottlePreviewDiv', {
        label: String(label ?? ''),
        value: String(value ?? ''),
      }))),
    warehouseBottlePreviewComment: physicalBottle?.comment ?
      renderTemplate('warehouseBottlePreviewComment', {comment: String(physicalBottle.comment ?? ''), }) : '',
    bottleActionButtons: bottleActionButtons(bottle, {detailLabelKey: 'warehouse.bottles.goToBottleDetails'}),
  });
}

/**
 * Prepares furniture elevation showing compartment sizes and contents.
 *
 * @param {*} w Width or value used by the calculation.
 * @param {*} room Warehouse room being inspected or modified.
 * @param {*} furniture Warehouse furniture record being modified.
 * @param {!Object=} options Options controlling the operation.
 * @return {!import('../ui/render-plan.js').RenderPlan} Furniture elevation showing compartment sizes and contents.
 */
function shelfPanel(w, room, furniture, {managementOnly = false} = {}) {
  const {rows, height: furnitureHeight, topSpace} = createShelfPanelModel(w, furniture);
  const shelves = composeMarkup(rows.map(({shelf, front, height, range, doorFront, doorLeaves, framed, occupied, occupants, overflow, canMoveUp, canMoveDown}) => {
    const doorLabel = ['door', 'glass'].includes(doorFront) ? [
      t(doorLeaves === 1 ? 'warehouse.doors.singleLeaf' : 'warehouse.doors.doubleLeaf'),
      doorFront === 'glass' ? t(framed ? 'warehouse.walls.withFrame' : 'warehouse.walls.withoutFrame').replace(/^./, ch => ch.toLowerCase()) : '',
      range ? t('warehouse.shelves.doorAcross', {from: range.from, to: range.to}) : '',
    ].filter(Boolean).map(label => ` · ${label}`).join('') : '';
    return renderTemplate('warehouseShelf', {
      shelfId: String(shelf.id ?? ''),
      capacity: shelf.capacity ?? 'unlimited',
      name: String(shelf.name ?? ''),
      front: t(FRONT_KEYS[front]),
      doorLabel: doorLabel,
      num: num(height),
      heightCm: shelf.heightCm == null ? ` ${t('warehouse.shelves.automaticHeight')}` : '',
      occupancyLabel: shelf.capacity === 0 ? '' : ` · ${occupied}${shelf.capacity === null ? '' : ` / ${shelf.capacity}`} ${t("forms.bottle.plural")}`,
      id: String(shelf.id ?? ''),
      disabledAttributes: canMoveUp ? {} : {"disabled": true},
      arrowUpIcon: arrowUpIcon,
      moveDownShelfId: String(shelf.id ?? ''),
      moveUpDisabled: canMoveDown ? {} : {"disabled": true},
      arrowDownIcon: arrowDownIcon,
      copyShelfId: String(shelf.id ?? ''),
      editShelfId: String(shelf.id ?? ''),
      deleteShelfId: String(shelf.id ?? ''),
      occupants: composeMarkup(occupants.map(b => bottleSymbol(b))),
      warehouseShelfView: overflow ?
        renderTemplate('warehouseShelfView', {
          id: String(shelf.id ?? ''),
          length: overflow,
        }) : '',
      hint: !occupied && shelf.capacity !== 0 ? renderTemplate('hint') : '',
    });
  }));
  return renderTemplate('panel', {
    name: String(furniture.name ?? ''),
    furnitureType: String((typeName(furniture.type)) ?? ''),
    sizeDescription: t(
      "warehouse.furniture.sizeDescription",
      {
        width: num(furniture.width),
        depth: num(furniture.depth),
        rotation: furniture.rotation,
        elevation: num(furniture.elevation ?? 0),
        height: num(furnitureHeight),
        shelves: furniture.shelves.length,
      }
    ),
    id: String(furniture.id ?? ''),
    editFurnitureId: String(furniture.id ?? ''),
    deleteFurnitureId: String(furniture.id ?? ''),
    hint: topSpace >= 1 ? renderTemplate('hint2', {remainingHeight: t("warehouse.shelves.remainingHeight", {height: num(topSpace)}), }) : '',
    managementOnly: managementOnly ? ' warehouse-shelves--management' : '',
    shelves: shelves || renderTemplate('hint3'),
    addShelfFurnitureId: String(furniture.id ?? ''),
    addActionLabel: addActionLabel(t("warehouse.shelves.addWithPlus")),
    warehouseFurniturePhotos: managementOnly ?
      renderTemplate('warehouseFurniturePhotos', {
        photos: composeMarkup((furniture.photos || []).map((photo) =>
          renderTemplate('warehousePhotoOpen', {
            path: String(photo.path ?? ''),
            title: String(furniture.name ?? ''),
            src: String(photo.path ?? ''),
            alt: String(furniture.name ?? ''),
            id: String(furniture.id ?? ''),
            photoId: String(photo.id ?? ''),
            closeIcon: closeIcon,
          }))),
        addActionLabel: addActionLabel(t('warehouse.photos.add')),
        furniturePhotos: String(furniture.id ?? ''),
        uploadFurnitureId: String(furniture.id ?? ''),
      }) : '',
  });
}


export {
  bottleSymbol, FRONT_KEYS, CAMERA_KEYS, ROOM_SECTION_KEYS, typeChoices,
  typeName, num, capacityLabel, count, field, choices, footer,
  bottleLabel, bottleListFacts, bottleRow, bottlePreview,
  bottleActionButtons, roomOptions, findFurniture, roomDiagram, shelfPanel
};
