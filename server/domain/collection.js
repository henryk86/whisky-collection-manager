/** Pure collection helpers. Bottles are always nested inside their owning bottling. */
import crypto from 'node:crypto';
export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();
export const WHISKY_TYPES = ['single_malt', 'single_grain', 'blended_malt', 'blended_grain', 'blended_scotch'];
export function allBottles(db) {
    return db.bottlings.flatMap(b => b.bottles || []);
}
export function findBottle(db, id) {
    for (const bottling of db.bottlings) {
        const bottle = (bottling.bottles || []).find(b => b.id === id);
        if (bottle) {
            return {
                bottling, bottle
            };
        }
    }
    return null;
}
