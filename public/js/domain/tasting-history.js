import { cloneFlavor } from './flavor-history.js';
import { normalizeTastingNotes } from './tasting.js';
export function cloneTasting(value) {
    return {flavorProfile:cloneFlavor(value.flavorProfile), tastingNotes:normalizeTastingNotes(value.tastingNotes),
        rating:value.rating ?? null, whiskyColor:value.whiskyColor ?? null};
}
/** History belongs to a single opened detail page; redo is invalidated on edit. */
export function createTastingHistory(value) {
    const entries = [cloneTasting(value)];
    let index = 0;
    return {
        get value() { return cloneTasting(entries[index]); },
        get canUndo() { return index > 0; },
        get canRedo() { return index < entries.length - 1; },
        record(value) {
            const next = cloneTasting(value);
            if (JSON.stringify(entries[index]) === JSON.stringify(next)) return false;
            entries.splice(index+1); entries.push(next); index++; return true;
        },
        undo() { if (index === 0) return false; index--; return true; },
        redo() { if (index >= entries.length-1) return false; index++; return true; },
    };
}
