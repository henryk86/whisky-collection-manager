/** Parse warehouse mutation inputs and validate furniture/shelf geometry.
 * Pure domain functions: no persistence, HTTP requests or UI state.
 * Keep the existing input normalization and error messages compatible.
 */
import {fail} from './errors.js';
import {FURNITURE_TYPES, SHELF_FRONTS, totalExplicitHeightCm}
  from '../../shared/warehouse-compartments.js';

const types = new Set(FURNITURE_TYPES);
/**
 * Validates a nonempty furniture or room name.
 *
 * @param {*} value Input value to process.
 * @return {string} Resulting text.
 */
export function name(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) throw fail('Name muss zwischen 1 und 100 Zeichen enthalten', 400, "api.errors.nameMustContainBetween1And100Characters");
  return value.trim();
}

/**
 * Validates a finite numeric warehouse field against bounds.
 *
 * @param {*} value Input value to process.
 * @param {*} field Field used by this operation.
 * @param {*} min Minimum permitted value.
 * @param {*} max Maximum permitted value.
 * @return {number} Calculated numeric result.
 */
export function number(value, field, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw fail(`${field}: ungültiger Wert`, 400, "api.errors.invalidField", {field});
  return Math.round(n * 100) / 100;
}

/**
 * Validates the rotation state and rejects invalid inputs.
 *
 * @param {*} value Value to process.
 * @return {number} Calculated numeric value.
 */
function rotation(value) {
  const n = Number(value ?? 0);
  if (![0, 90, 180, 270].includes(n)) throw fail('Drehung nur 0, 90, 180 oder 270 Grad', 400, "api.errors.rotationMustBe090180Or270Degrees");
  return n;
}

/**
 * Validates a shelf's physical bottle capacity.
 *
 * @param {*} value Input value to process.
 * @return {?number} Calculated numeric result.
 */
export function capacity(value) {
  if (value === null || value === '' || value === undefined) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 10000) throw fail(
    'Kapazität muss eine ganze Zahl zwischen 0 und 10000 sein',
    400,
    "api.errors.capacityMustBeAnIntegerBetween0And10000"
  );
  return n;
}

/**
 * Validates the front-edge configuration of a shelf.
 *
 * @param {*} value Input value to process.
 * @return {*} Computed value, or null when the input has no match.
 */
export function shelfFront(value) {
  if (value === '' || value === null || value === undefined) return null;
  if (!SHELF_FRONTS.includes(value)) throw fail('Ungültige Fachfront', 400, "api.errors.invalidCompartmentFront");
  return value;
}

/**
 * Validates the number and geometry of door leaves.
 *
 * @param {*} value Input value to process.
 * @return {*} Computed value, or null when the input has no match.
 */
export function doorLeaves(value) {
  if (value === undefined || value === null || value === '') return null;
  if (value !== 1 && value !== 2) throw fail('Türflügel: nur 1 oder 2 erlaubt', 400, "api.errors.doorLeafCountMustBe1Or2");
  return value;
}

/**
 * Validates a glass-door frame specification.
 *
 * @param {*} value Input value to process.
 * @return {?boolean} Computed value, or null when the input has no match.
 */
export function glassFrame(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'boolean') throw fail('Glasrahmen: ungültiger Wert', 400, "api.errors.invalidGlassFrameValue");
  return value;
}

/**
 * Validates shelf ranges covered by furniture doors.
 *
 * @param {*} value Input value to process.
 * @param {*} shelves Shelves used by this operation.
 * @return {!Array<!Object>} Resulting list of values.
 */
export function doorRanges(value, shelves) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 100) throw fail('Türbereiche: ungültige Liste', 400, "api.errors.invalidListOfDoorAreas");
  const covered = new Set();
  return value.map(range => {
    if (!range || typeof range !== 'object' || !Number.isInteger(range.from) || !Number.isInteger(range.to) ||
      range.from < 1 || range.to > shelves.length || range.from > range.to ||
      !['door', 'glass'].includes(range.front)) throw fail(
        'Türbereich: Fachnummern oder Front ungültig',
        400,
        "api.errors.doorAreaHasInvalidCompartmentNumbersOrFront"
      );
    for (let i = range.from; i <= range.to; i++) {
      if (covered.has(i)) throw fail('Türbereiche dürfen sich nicht überlappen', 400, "api.errors.doorAreasMustNotOverlap");
      covered.add(i);
    }
    return {
      from: range.from,
      to: range.to,
      front: range.front,
      doorLeaves: doorLeaves(range.doorLeaves),
      glassFrame: glassFrame(range.glassFrame),
    };
  });
}

/**
 * Validates the available height for a storage shelf.
 *
 * @param {*} value Input value to process.
 * @return {?number} Calculated numeric result.
 */
export function shelfHeight(value) {
  if (value === '' || value === null || value === undefined) return null;
  return number(value, 'Fachhöhe in cm', 5, 500);
}

/**
 * Verifies all configured shelf heights fit the furniture.
 *
 * @param {*} furniture Furniture configuration including its dimensions.
 * @param {*=} shelves Shelves used by this operation.
 * @param {number=} height Height in pixels.
 */
export function ensureShelfHeights(
  furniture,
  shelves = furniture.shelves,
  height = furniture.itemHeight ?? (furniture.type === 'haengeregal' ? 0.4 : 1.8)
) {
  const used = totalExplicitHeightCm(shelves);
  if (used > height * 100 + 0.001) throw fail('Fachhöhen überschreiten die Möbelhöhe', 409, "api.errors.compartmentHeightsExceedTheFurnitureHeight");
  // Preserve legacy all-automatic layouts. In a partly specified layout, an
  // automatic bay must have at least 5 cm left to be a usable compartment.
  const automatic = shelves.filter(shelf => shelf.heightCm == null).length;
  if (used > 0 && automatic && height * 100 - used < automatic * 5 - 0.001)
    throw fail(
      'Für automatisch eingeteilte Fächer bleiben weniger als 5 cm übrig',
      409,
      "api.errors.lessThan5CmRemainsForAutomaticallyDividedCompartments"
    );
}

/**
 * Validates the panel option state and rejects invalid inputs.
 *
 * @param {*} value Value to process.
 * @param {*} label Label shown to the user.
 * @return {boolean} Whether the operation matched or succeeded.
 */
function panelOption(value, label) {
  if (value === undefined) return false;
  if (typeof value !== 'boolean') throw fail(`${label}: ungültiger Wert`, 400, "api.errors.invalidField", {field: label});
  return value;
}

/**
 * Validates the structure and dimensions of a warehouse layout.
 *
 * @param {*} input Input to process.
 * @param {*} room Room model containing dimensions and furniture.
 * @return {!Object} Structured result for the caller.
 */
export function layout(input, room) {
  const furniture = {
    name: name(input.name),
    type: types.has(input.type) ? input.type : 'sonstiges',
    x: number(input.x ?? 0, 'x', 0, room.width),
    y: number(input.y ?? 0, 'y', 0, room.height),
    width: number(input.width ?? 1, 'width', 0.2, 20),
    depth: number(input.depth ?? 0.5, 'depth', 0.2, 20),
    rotation: rotation(input.rotation),
    leftSidePanel: panelOption(input.leftSidePanel, 'leftSidePanel'),
    rightSidePanel: panelOption(input.rightSidePanel, 'rightSidePanel'),
    backPanel: panelOption(input.backPanel, 'backPanel'),
    doorLeaves: doorLeaves(input.doorLeaves),
    glassFrame: glassFrame(input.glassFrame),
    doorRanges: doorRanges(input.doorRanges, input.shelves || []),
    // Backward compatible: older warehouse.json files have no vertical
    // coordinates.
    elevation: number(input.elevation ?? 0, 'elevation', 0, 10),
    itemHeight: number(input.itemHeight ?? (input.type === 'haengeregal' ? 0.4 : 1.8), 'itemHeight', 0.1, 5),
  };
  const w = furniture.rotation % 180 === 0 ? furniture.width : furniture.depth;
  const h = furniture.rotation % 180 === 0 ? furniture.depth : furniture.width;
  if (furniture.x + w > room.width + 0.00001 || furniture.y + h > room.height + 0.00001) throw fail(
    'Lagermöbel liegt außerhalb der Raumgrenzen',
    400,
    "api.errors.storageFurnitureLiesOutsideTheRoomBoundaries"
  );
  return furniture;
}
