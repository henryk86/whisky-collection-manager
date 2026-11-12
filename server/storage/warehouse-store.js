/** Warehouse is a separate document. Neither reads nor writes collection.json. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR } from './paths.js';
import { fail } from '../domain/errors.js';
import { FURNITURE_TYPES, SHELF_FRONTS, totalExplicitHeightCm } from '../../public/js/domain/warehouse-compartments.js';

export const WAREHOUSE_FILE = path.join(DATA_DIR, 'warehouse.json');
export const emptyWarehouse = () => ({ schemaVersion: 1, rooms: [], assignments: {} });

function validText(value, max = 100) {
    return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}
function validNumber(value, min, max) {
    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
export function validateWarehouse(data) {
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.rooms) ||
        !data.assignments || typeof data.assignments !== 'object' || Array.isArray(data.assignments)) {
        throw fail('Ungültige Lagerdatei', 400);
    }
    const ids = new Set();
    const shelfIds = new Set();
    for (const room of data.rooms) {
        if (!validText(room.id, 120) || !validText(room.name) || !validNumber(room.width, 1, 100) || !validNumber(room.height, 1, 100) || !Array.isArray(room.furniture)) throw fail('Ungültiger Lagerraum');
        if (ids.has(room.id)) throw fail('Doppelte Lager-ID'); ids.add(room.id);
        for (const furniture of room.furniture) {
            if (!validText(furniture.id, 120) || !validText(furniture.name) || !FURNITURE_TYPES.includes(furniture.type) ||
                !validNumber(furniture.x, 0, room.width) || !validNumber(furniture.y, 0, room.height) || !validNumber(furniture.width, 0.2, 20) || !validNumber(furniture.depth, 0.2, 20) || ![0, 90, 180, 270].includes(furniture.rotation) ||
                (furniture.elevation !== undefined && !validNumber(furniture.elevation, 0, 10)) ||
                (furniture.itemHeight !== undefined && !validNumber(furniture.itemHeight, 0.1, 5)) ||
                ['leftSidePanel', 'rightSidePanel', 'backPanel'].some(key => furniture[key] !== undefined && typeof furniture[key] !== 'boolean') ||
                (furniture.doorLeaves != null && ![1,2].includes(furniture.doorLeaves)) ||
                (furniture.glassFrame != null && typeof furniture.glassFrame !== 'boolean') ||
                !Array.isArray(furniture.shelves)) throw fail('Ungültiges Lagermöbel');
            if (furniture.doorRanges !== undefined) {
                if (!Array.isArray(furniture.doorRanges) || furniture.doorRanges.length > 100) throw fail('Ungültige Türbereiche');
                const covered = new Set();
                for (const range of furniture.doorRanges) {
                    if (!range || !Number.isInteger(range.from) || !Number.isInteger(range.to) || range.from < 1 ||
                        range.to < range.from || range.to > furniture.shelves.length || !['door','glass'].includes(range.front) ||
                        (range.doorLeaves != null && ![1,2].includes(range.doorLeaves)) ||
                        (range.glassFrame != null && typeof range.glassFrame !== 'boolean')) throw fail('Ungültiger Türbereich');
                    for (let i=range.from;i<=range.to;i++) {
                        if (covered.has(i)) throw fail('Überlappende Türbereiche');
                        covered.add(i);
                    }
                }
            }
            const effectiveW = furniture.rotation % 180 === 0 ? furniture.width : furniture.depth;
            const effectiveH = furniture.rotation % 180 === 0 ? furniture.depth : furniture.width;
            if (furniture.x + effectiveW > room.width + 0.00001 || furniture.y + effectiveH > room.height + 0.00001) throw fail('Lagermöbel liegt außerhalb des Raums');
            if (ids.has(furniture.id)) throw fail('Doppelte Lager-ID'); ids.add(furniture.id);
            for (const shelf of furniture.shelves) {
                if (!validText(shelf.id, 120) || !validText(shelf.name) || (shelf.capacity !== null && (!Number.isInteger(shelf.capacity) || shelf.capacity < 0 || shelf.capacity > 10000)) ||
                    (shelf.front !== undefined && shelf.front !== null && !SHELF_FRONTS.includes(shelf.front)) ||
                    (shelf.heightCm !== undefined && shelf.heightCm !== null && !validNumber(shelf.heightCm, 5, 500)) ||
                    (shelf.doorLeaves != null && ![1,2].includes(shelf.doorLeaves)) ||
                    (shelf.glassFrame != null && typeof shelf.glassFrame !== 'boolean')) throw fail('Ungültiges Lagerfach');
                if (ids.has(shelf.id)) throw fail('Doppelte Lager-ID'); ids.add(shelf.id); shelfIds.add(shelf.id);
            }
            const explicit = totalExplicitHeightCm(furniture.shelves);
            const available = (furniture.itemHeight ?? (furniture.type === 'haengeregal' ? 0.4 : 1.8)) * 100;
            const autoCount = furniture.shelves.filter(shelf => shelf.heightCm == null).length;
            if (explicit > available + 0.001 || (explicit > 0 && autoCount && available - explicit < autoCount * 5 - 0.001))
                throw fail('Die Fachhöhen passen nicht zur Möbelhöhe');
        }
    }
    for (const [bottleId, shelfId] of Object.entries(data.assignments)) {
        if (!validText(bottleId, 120) || !shelfIds.has(shelfId)) throw fail('Ungültige Lagerzuordnung');
    }
    return data;
}

export function initWarehouse() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(WAREHOUSE_FILE)) writeWarehouse(emptyWarehouse());
    validateWarehouse(JSON.parse(fs.readFileSync(WAREHOUSE_FILE, 'utf8')));
}
export function readWarehouse() {
    initWarehouse();
    return validateWarehouse(JSON.parse(fs.readFileSync(WAREHOUSE_FILE, 'utf8')));
}
function writeWarehouse(data) {
    validateWarehouse(data);
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const temporary = `${WAREHOUSE_FILE}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
        fs.writeFileSync(temporary, JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
        fs.renameSync(temporary, WAREHOUSE_FILE);
    } finally { if (fs.existsSync(temporary)) fs.rmSync(temporary); }
}
let pending = Promise.resolve();
export function changeWarehouse(mutator) {
    const task = pending.then(async () => {
        const data = readWarehouse();
        const result = await mutator(data);
        writeWarehouse(data);
        return result;
    });
    pending = task.catch(() => {});
    return task;
}
