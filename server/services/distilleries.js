import { change } from '../storage/collection-store.js';
import { requireField } from '../domain/validation.js';
import { uid } from '../domain/collection.js';
import { fail } from '../domain/errors.js';
function locationFromInput(input) {
    const lat = input.latitude, lon = input.longitude;
    if (lat == null && lon == null) return { latitude: null, longitude: null };
    if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90 ||
        typeof lon !== 'number' || !Number.isFinite(lon) || lon < -180 || lon > 180) {
        throw fail('Breitengrad und Längengrad müssen gültige Zahlen sein');
    }
    return { latitude: lat, longitude: lon };
}
function uniqueName(collection, value, currentId = null) {
    const name = requireField(value, 'Destilleriename');
    const duplicate = collection.distilleries.some(entry => entry.id !== currentId && entry.name.toLowerCase() === name.toLowerCase());
    if (duplicate) {
        throw fail('Destillerie existiert bereits', 409);
    }
    return name;
}
function validStatus(value) {
    if (!['active', 'closed', 'reopened', 'unknown'].includes(value)) throw fail('Ungültiger Destilleriestatus');
    return value;
}
export function createDistillery(input) {
    return change(collection => {
        const distillery = {
            id: uid(), name: uniqueName(collection, input.name), status: validStatus(input.status || 'unknown'), ...locationFromInput(input)
        };
        collection.distilleries.push(distillery);
        return distillery;
    });
}
export function updateDistillery(id, input) {
    return change(collection => {
        const distillery = collection.distilleries.find(entry => entry.id === id);
        if (!distillery) {
            throw fail('Destillerie nicht gefunden', 404);
        }
        distillery.name = uniqueName(collection, input.name, id);
        if (Object.hasOwn(input, 'status')) distillery.status = validStatus(input.status);
        if (Object.hasOwn(input, 'latitude') || Object.hasOwn(input, 'longitude')) {
            Object.assign(distillery, locationFromInput(input));
        }
        return distillery;
    });
}
