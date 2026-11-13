/**
 * A temporary, in-memory bridge between the browser extension and the local app.
 * Nothing is written to disk until a user selects a physical bottle and saves.
 * Staged images expire after 15 minutes and do not appear in collection.json.
 */
import crypto from 'node:crypto';
import { assert, fail } from '../domain/errors.js';
import { validateImageData } from '../storage/photos.js';
import { addPhoto } from './bottles.js';
const pending = new Map();
const MAX_PENDING = 8;
const TTL = 15 * 60 * 1000;
function cleanup() {
    for (const [token, entry] of pending) if (Date.now() > entry.expires) pending.delete(token);
}
export function stageImage(input) {
    cleanup();
    assert(pending.size < MAX_PENDING, 'Zu viele ausstehende Bilder; bitte später erneut versuchen');
    const { bytes, mediaType } = validateImageData(input.image);
    // Legacy browser-extension uploads have no source property and originate from
    // Whiskybase. New import adapters can explicitly use null for unlabelled photos.
    const source = input.source === undefined || input.source === 'whiskybase'
        ? 'whiskybase' : null; // Unknown import providers must never be mislabelled.
    const token = crypto.randomUUID();
    pending.set(token, { image: input.image, bytes, mediaType, source, expires: Date.now() + TTL });
    setTimeout(() => pending.delete(token), TTL).unref();
    return { token, expiresInSeconds: TTL / 1000 };
}
export function previewImage(token) {
    cleanup();
    const entry = pending.get(token);
    if (!entry) throw fail('Vorschau abgelaufen oder Bild nicht vorhanden', 404);
    return { bytes: entry.bytes, type: entry.mediaType };
}
export async function attachImageToBottle(bottleId, input) {
    cleanup();
    if (typeof input.token !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.token)) throw fail('Ungültiger Bild-Token');
    const entry = pending.get(input.token);
    if (!entry) throw fail('Importiertes Bild nicht mehr verfügbar. Bitte erneut importieren.', 404);
    const photo = await addPhoto(bottleId, { image: entry.image, ...(entry.source ? { source: entry.source } : {}) });
    pending.delete(input.token);
    return photo;
}
