/** Preserve leading zeroes. Historical numbers remain skipped by auto-suggest, but may be reassigned once free. */
import { allBottles } from './collection.js';
export function suggestNumber(db) {
    const used = new Set([...db.reservedInventoryNumbers, ...allBottles(db).map(b => b.inventoryNumber).filter(Boolean)]);
    let n = db.nextInventoryNumber;
    while (used.has(String(n).padStart(6, '0'))) {
        n++;
    }
    return String(n).padStart(6, '0');
}
export function markNumber(db, value) {
    if (!value) {
        return;
    }
    // History is used for new-number suggestions, not as a permanent assignment ban.
    // The collection-wide validator still prevents two current bottles sharing a number.
    if (!db.reservedInventoryNumbers.includes(value)) {
        db.reservedInventoryNumbers.push(value);
    }
    if (/^\d+$/.test(value)) {
        const numeric = Number(value);
        if (Number.isSafeInteger(numeric) && numeric >= db.nextInventoryNumber) {
            db.nextInventoryNumber = numeric + 1;
        }
    }
}
