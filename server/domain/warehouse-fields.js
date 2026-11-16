/** Parse warehouse mutation inputs and validate furniture/shelf geometry.
 * Pure domain functions: no persistence, HTTP requests or UI state.
 * Keep the existing input normalization and error messages compatible.
 */
import { fail } from './errors.js';
import { FURNITURE_TYPES, SHELF_FRONTS, totalExplicitHeightCm } from '../../public/js/domain/warehouse-compartments.js';

const types = new Set(FURNITURE_TYPES);
export function name(value) {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) throw fail('Name muss zwischen 1 und 100 Zeichen enthalten');
    return value.trim();
}
export function number(value, field, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max) throw fail(`${field}: ungültiger Wert`);
    return Math.round(n * 100) / 100;
}
function rotation(value) {
    const n = Number(value ?? 0);
    if (![0, 90, 180, 270].includes(n)) throw fail('Drehung nur 0, 90, 180 oder 270 Grad');
    return n;
}
export function capacity(value) {
    if (value === null || value === '' || value === undefined) return null;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 10000) throw fail('Kapazität muss eine ganze Zahl zwischen 0 und 10000 sein');
    return n;
}
export function shelfFront(value) {
    if (value === '' || value === null || value === undefined) return null;
    if (!SHELF_FRONTS.includes(value)) throw fail('Ungültige Fachfront');
    return value;
}
export function doorLeaves(value) {
    if (value === undefined || value === null || value === '') return null;
    if (value !== 1 && value !== 2) throw fail('Türflügel: nur 1 oder 2 erlaubt');
    return value;
}
export function glassFrame(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'boolean') throw fail('Glasrahmen: ungültiger Wert');
    return value;
}
export function doorRanges(value, shelves) {
    if (value == null) return [];
    if (!Array.isArray(value) || value.length > 100) throw fail('Türbereiche: ungültige Liste');
    const covered = new Set();
    return value.map(range => {
        if (!range || typeof range !== 'object' || !Number.isInteger(range.from) || !Number.isInteger(range.to) ||
            range.from < 1 || range.to > shelves.length || range.from > range.to ||
            !['door','glass'].includes(range.front)) throw fail('Türbereich: Fachnummern oder Front ungültig');
        for (let i=range.from;i<=range.to;i++) {
            if (covered.has(i)) throw fail('Türbereiche dürfen sich nicht überlappen');
            covered.add(i);
        }
        return {from:range.from,to:range.to,front:range.front,
            doorLeaves:doorLeaves(range.doorLeaves),glassFrame:glassFrame(range.glassFrame)};
    });
}
export function shelfHeight(value) {
    if (value === '' || value === null || value === undefined) return null;
    return number(value, 'Fachhöhe in cm', 5, 500);
}
export function ensureShelfHeights(furniture, shelves = furniture.shelves, height = furniture.itemHeight ?? (furniture.type === 'haengeregal' ? 0.4 : 1.8)) {
    const used = totalExplicitHeightCm(shelves);
    if (used > height * 100 + 0.001) throw fail('Fachhöhen überschreiten die Möbelhöhe', 409);
    // Preserve legacy all-automatic layouts. In a partly specified layout, an
    // automatic bay must have at least 5 cm left to be a usable compartment.
    const automatic = shelves.filter(shelf => shelf.heightCm == null).length;
    if (used > 0 && automatic && height * 100 - used < automatic * 5 - 0.001)
        throw fail('Für automatisch eingeteilte Fächer bleiben weniger als 5 cm übrig', 409);
}

function panelOption(value, label) {
    if (value === undefined) return false;
    if (typeof value !== 'boolean') throw fail(`${label}: ungültiger Wert`);
    return value;
}
export function layout(input, room) {
    const furniture = {
        name: name(input.name), type: types.has(input.type) ? input.type : 'sonstiges',
        x: number(input.x ?? 0, 'Position X', 0, room.width),
        y: number(input.y ?? 0, 'Position Y', 0, room.height),
        width: number(input.width ?? 1, 'Breite', 0.2, 20),
        depth: number(input.depth ?? 0.5, 'Tiefe', 0.2, 20),
        rotation: rotation(input.rotation),
        leftSidePanel: panelOption(input.leftSidePanel, 'Linke Seitenwand'),
        rightSidePanel: panelOption(input.rightSidePanel, 'Rechte Seitenwand'),
        backPanel: panelOption(input.backPanel, 'Rückwand'),
        doorLeaves: doorLeaves(input.doorLeaves),
        glassFrame: glassFrame(input.glassFrame),
        doorRanges: doorRanges(input.doorRanges, input.shelves || []),
        // Backward compatible: older warehouse.json files have no vertical coordinates.
        elevation: number(input.elevation ?? 0, 'Unterkante über Boden', 0, 10),
        itemHeight: number(input.itemHeight ?? (input.type === 'haengeregal' ? 0.4 : 1.8), 'Möbelhöhe', 0.1, 5),
    };
    const w = furniture.rotation % 180 === 0 ? furniture.width : furniture.depth;
    const h = furniture.rotation % 180 === 0 ? furniture.depth : furniture.width;
    if (furniture.x + w > room.width + 0.00001 || furniture.y + h > room.height + 0.00001) throw fail('Lagermöbel liegt außerhalb der Raumgrenzen');
    return furniture;
}
