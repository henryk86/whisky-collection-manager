/** Optional human-initiated, single-name OSM Nominatim lookup.
 * Never used for automatic page loads or mass geocoding. The user chooses a
 * candidate before coordinates are saved. Cache repeated searches.
 * See https://operations.osmfoundation.org/policies/nominatim/
 */
import { fail } from '../domain/errors.js';
import fs from 'node:fs';
const appVersion = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;
const cache = new Map();
let lastLookup = 0;
const MIN_INTERVAL_MS = 1200;
const CACHE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_URL = 'https://nominatim.openstreetmap.org/search';

export async function findDistilleryLocations(input, { now = Date.now, fetchImpl = fetch } = {}) {
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    if (name.length < 2 || name.length > 150 || /[\x00-\x1f]/.test(name)) {
        throw fail('Bitte einen gültigen Destillerienamen eingeben', 400);
    }
    const key = name.toLocaleLowerCase('de');
    const cached = cache.get(key);
    if (cached && now() - cached.at < CACHE_MS) return cached.matches;
    if (now() - lastLookup < MIN_INTERVAL_MS) {
        throw fail('Bitte vor der nächsten Standortsuche kurz warten', 429);
    }
    lastLookup = now();
    const endpoint = process.env.OSM_GEOCODING_URL || DEFAULT_URL;
    let url;
    try {
        url = new URL(endpoint);
        if (url.protocol !== 'https:') throw new Error('Unsicherer Endpunkt');
        url.searchParams.set('q', `${name} distillery`);
        url.searchParams.set('format', 'jsonv2');
        url.searchParams.set('limit', '5');
        url.searchParams.set('addressdetails', '0');
    } catch {
        throw fail('Ungültiger OSM-Geocoding-Endpunkt', 503);
    }
    let raw;
    try {
        const response = await fetchImpl(url, {
            signal: AbortSignal.timeout(8000),
            headers: {
                'User-Agent': `WhiskyCollectionManager/${appVersion} (+https://github.com/henryk86/whisky-collection-manager)`,
                'Accept': 'application/json',
                'Accept-Language': 'en',
            },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        raw = await response.json();
    } catch {
        throw fail('Die OpenStreetMap-Standortsuche ist derzeit nicht erreichbar. Koordinaten können manuell eingetragen werden.', 503);
    }
    if (!Array.isArray(raw)) throw fail('Ungültige Antwort der Standortsuche', 503);
    const matches = raw.slice(0, 5).map(item => ({
        name: String(item.display_name || '').slice(0, 250),
        latitude: Number(item.lat), longitude: Number(item.lon),
    })).filter(item => item.name && Number.isFinite(item.latitude) && Math.abs(item.latitude) <= 90 &&
        Number.isFinite(item.longitude) && Math.abs(item.longitude) <= 180);
    cache.set(key, { at: now(), matches });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return matches;
}
