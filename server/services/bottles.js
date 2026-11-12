import { read, change } from '../storage/collection-store.js';
import { saveImage, deleteImage, validateImageData } from '../storage/photos.js';
import { saveDocument, readDocument, deleteDocument } from '../storage/documents.js';
import { normalizeBottle } from '../domain/normalization.js';
import { markNumber } from '../domain/inventory.js';
import { findBottle, now, uid } from '../domain/collection.js';
import { fail } from '../domain/errors.js';
function requireBottle(collection, id) {
    const result = findBottle(collection, id);
    if (!result) {
        throw fail('Flasche nicht gefunden', 404);
    }
    return result;
}
export function createBottle(input) {
    return change(collection => {
        const bottling = collection.bottlings.find(entry => entry.id === input.bottlingId);
        if (!bottling) {
            throw fail('Abfüllung nicht gefunden', 404);
        }
        const bottle = {
            ...normalizeBottle(input), id: uid(), photos: [], files: [], createdAt: now(), updatedAt: now()
        };
        if (bottle.volumeType === 'standard' && bottle.volumeMl == null && bottling.volumeMl != null) {
            bottle.volumeMl = bottling.volumeMl;
        }
        markNumber(collection, bottle.inventoryNumber);
        bottling.bottles.push(bottle);
        return bottle;
    });
}
export function updateBottle(id, input) {
    return change(collection => {
        const { bottle } = requireBottle(collection, id);
        const next = normalizeBottle(input, bottle);
        if (next.inventoryNumber !== bottle.inventoryNumber) {
            markNumber(collection, next.inventoryNumber);
        }
        Object.assign(bottle, next, {
            updatedAt: now()
        });
        return bottle;
    });
}
export function deleteBottle(id) {
    return change(collection => {
        const { bottling, bottle } = requireBottle(collection, id);
        bottling.bottles.splice(bottling.bottles.indexOf(bottle), 1);
        // Keep files on disk, as before; old backups may still reference these photos.
        return {
            ok: true, photos: (bottle.photos || []).map(photo => photo.path), files: (bottle.files || []).map(file => file.path)
        };
    });
}
export async function addPhoto(id, input) {
    requireBottle(read(), id);
    const photoId = uid();
    const imagePath = saveImage(input.image, id, `photo-${photoId}`);
    try {
        return await change(collection => {
            const { bottle } = requireBottle(collection, id);
            const photo = {
                id: photoId, path: imagePath, createdAt: now(),
                ...(input.source === 'whiskybase' ? { source: 'whiskybase' } : {})
            };
            bottle.photos ??= [];
            bottle.photos.push(photo);
            bottle.updatedAt = now();
            return photo;
        });
    }
    catch (error) {
        // Compensate the file write if the collection transaction was rejected.
        deleteImage(imagePath);
        throw error;
    }
}
/** Reorder only existing photos; IDs and file paths cannot be changed here. */
export async function reorderPhotos(bottleId, input) {
    if (!Array.isArray(input.photoIds) || input.photoIds.some(id => typeof id !== 'string')) {
        throw fail('Ungültige Fotoreihenfolge');
    }
    return change(collection => {
        const { bottle } = requireBottle(collection, bottleId);
        const photos = bottle.photos || [];
        const expected = new Set(photos.map(photo => photo.id));
        if (input.photoIds.length !== photos.length || new Set(input.photoIds).size !== photos.length ||
            input.photoIds.some(id => !expected.has(id))) {
            throw fail('Die Fotoreihenfolge enthält unbekannte oder doppelte IDs', 409);
        }
        const byId = new Map(photos.map(photo => [photo.id, photo]));
        bottle.photos = input.photoIds.map(id => byId.get(id));
        bottle.updatedAt = now();
        return bottle.photos;
    });
}

export async function removePhoto(bottleId, photoId) {
    const removed = await change(collection => {
        const { bottle } = requireBottle(collection, bottleId);
        const index = (bottle.photos || []).findIndex(photo => photo.id === photoId);
        if (index < 0) {
            throw fail('Foto nicht gefunden', 404);
        }
        const [photo] = bottle.photos.splice(index, 1);
        bottle.updatedAt = now();
        return photo;
    });
    deleteImage(removed.path);
    deleteImage(removed.cutout?.path);
    return {
        ok: true
    };
}

/** The original photo never changes. Each saved cutout has a unique filename so
 * a rejected collection transaction cannot damage the previous result. */
export async function savePhotoCutout(bottleId, photoId, input) {
    const photo = requireBottle(read(), bottleId).bottle.photos?.find(item => item.id === photoId);
    if (!photo) throw fail('Foto nicht gefunden', 404);
    // No arbitrary image files or imported URLs; the client generates a transparent PNG.
    if (typeof input?.image !== 'string' || !input.image.startsWith('data:image/png;base64,'))
        throw fail('Freistellung muss ein PNG-Bild sein');
    validateImageData(input.image);
    const stored = saveImage(input.image, bottleId, `photo-${photoId}-cutout-${uid()}`);
    let previous;
    try {
        const updated = await change(collection => {
            const { bottle } = requireBottle(collection, bottleId);
            const item = (bottle.photos || []).find(p => p.id === photoId);
            if (!item) throw fail('Foto nicht gefunden', 404);
            previous = item.cutout?.path;
            item.cutout = { path: stored, model: 'u2netp-v1', selected: true };
            bottle.updatedAt = now();
            return item;
        });
        if (previous && previous !== stored) deleteImage(previous);
        return updated;
    } catch (error) {
        deleteImage(stored);
        throw error;
    }
}

/** Selecting the original does not delete the computed cutout. */
export function selectPhotoCutout(bottleId, photoId, input) {
    if (typeof input?.selected !== 'boolean') throw fail('Ungültige Bildauswahl');
    return change(collection => {
        const { bottle } = requireBottle(collection, bottleId);
        const photo = (bottle.photos || []).find(item => item.id === photoId);
        if (!photo) throw fail('Foto nicht gefunden', 404);
        if (!photo.cutout) throw fail('Keine Freistellung vorhanden', 409);
        photo.cutout.selected = input.selected;
        bottle.updatedAt = now();
        return photo;
    });
}

export async function removePhotoCutout(bottleId, photoId) {
    const old = await change(collection => {
        const { bottle } = requireBottle(collection, bottleId);
        const photo = (bottle.photos || []).find(item => item.id === photoId);
        if (!photo) throw fail('Foto nicht gefunden', 404);
        if (!photo.cutout) throw fail('Keine Freistellung vorhanden', 404);
        const path = photo.cutout.path;
        delete photo.cutout;
        bottle.updatedAt = now();
        return path;
    });
    deleteImage(old);
    return { ok: true };
}

/** Attach a receipt, photo, or document to one concrete physical bottle. */
export async function addFile(bottleId, input) {
    requireBottle(read(), bottleId);
    const file = saveDocument(bottleId, input);
    try {
        return await change(collection => {
            const { bottle } = requireBottle(collection, bottleId);
            bottle.files ??= [];
            bottle.files.push(file);
            bottle.updatedAt = now();
            return file;
        });
    }
    catch (error) {
        deleteDocument(file.path);
        throw error;
    }
}
/** Only an attachment referenced by the requested bottle can be downloaded. */
export function downloadFile(bottleId, fileId) {
    const { bottle } = requireBottle(read(), bottleId);
    const entry = (bottle.files || []).find(file => file.id === fileId);
    if (!entry) throw fail('Datei nicht gefunden', 404);
    return {
        filename: entry.name,
        type: 'application/octet-stream',
        bytes: readDocument(entry.path)
    };
}
export async function removeFile(bottleId, fileId) {
    const removed = await change(collection => {
        const { bottle } = requireBottle(collection, bottleId);
        const index = (bottle.files || []).findIndex(file => file.id === fileId);
        if (index < 0) throw fail('Datei nicht gefunden', 404);
        const [file] = bottle.files.splice(index, 1);
        bottle.updatedAt = now();
        return file;
    });
    deleteDocument(removed.path);
    return { ok: true };
}
