import { fail } from '../domain/errors.js';
import { ALLOWED_HOSTS } from '../config.js';

/** Chrome/Edge extension origins are limited to the image-staging API. */
const EXTENSION_ORIGIN = /^chrome-extension:\/\/([a-p]{32})$/;

export function allowedExtensionOrigin(origin, configuredIds = process.env.EXTENSION_IDS || '') {
    const match = EXTENSION_ORIGIN.exec(origin);
    if (!match) return false;
    const allowed = configuredIds.split(',').map(id => id.trim()).filter(Boolean);
    return allowed.length === 0 || allowed.includes(match[1]);
}

/** Reject cross-origin mutations even when the request is CORS-simple. */
export function requireSameOriginMutation(request, url, { extensionStage = false } = {}) {
    const method = request.method;
    if (!url.pathname.startsWith('/api/') || method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
    const origin = request.headers.origin;
    if (extensionStage && origin && allowedExtensionOrigin(origin)) return;
    const fetchSite = request.headers['sec-fetch-site'];
    if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
        throw fail('Schreibzugriff von fremder Webseite nicht erlaubt', 403);
    }
    if (origin) {
        let supplied;
        try { supplied = new URL(origin); } catch { throw fail('Ungültiger Origin-Header', 403); }
        const scheme = request.socket?.encrypted ? 'https:' : 'http:';
        if (supplied.origin !== `${scheme}//${url.host}`) {
            throw fail('Schreibzugriff von fremder Webseite nicht erlaubt', 403);
        }
    }
}

/** Host validation prevents DNS rebinding of this intentionally unauthenticated LAN app. */
const warnedHosts = new Set();
const MAX_HOST_WARNINGS = 20;
let warnedHostLimit = false;
const HOST_REJECTION_MESSAGE = 'Nicht erlaubter Host. Adresse in ALLOWED_HOSTS oder CERT_DNS_NAMES/CERT_IP_ADDRESSES eintragen.';

function rejectHost(raw, hostname) {
    // Log once per rejected hostname, with a hard limit to prevent noisy requests
    // from flooding logs or growing an unbounded diagnostic cache.
    const label = String(hostname || raw || '(fehlend)').replace(/[\r\n\x00-\x1f\x7f]/g, '?').slice(0, 120);
    if (!warnedHosts.has(label)) {
        if (warnedHosts.size < MAX_HOST_WARNINGS) {
            warnedHosts.add(label);
            console.warn(`Abgelehnter HTTP-Host: ${label}. Erlaubte Adressen in ALLOWED_HOSTS oder CERT_DNS_NAMES/CERT_IP_ADDRESSES eintragen.`);
        } else if (!warnedHostLimit) {
            warnedHostLimit = true;
            console.warn('Weitere abgelehnte Hosts werden nicht mehr einzeln protokolliert (Limit: 20). ALLOWED_HOSTS und CERT_DNS_NAMES/CERT_IP_ADDRESSES pruefen.');
        }
    }
    throw fail(HOST_REJECTION_MESSAGE, 421);
}

export function requireAllowedHost(request) {
    const raw = request.headers.host || '';
    if (!/^(?:\[[a-f0-9:.]+\]|[a-z0-9.-]+)(?::\d{1,5})?$/i.test(raw)) {
        rejectHost(raw);
    }
    let hostname;
    try { hostname = new URL(`http://${raw}`).hostname.toLowerCase().replace(/^\[|\]$/g, ''); }
    catch { rejectHost(raw); }
    if (!ALLOWED_HOSTS.has(hostname)) rejectHost(raw, hostname);
}
