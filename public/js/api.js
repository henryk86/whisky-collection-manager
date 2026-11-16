import { t } from './i18n/index.js';
import { applyResourceDelta } from '../../shared/resource-delta.js';

/** All frontend HTTP requests use this helper for consistent localized response/error handling. */
export async function request(url, options = {}) {
    let res;
    try {
        res = await fetch(url, {
            ...options, headers: {
                ...(['POST','PUT','PATCH','DELETE'].includes((options.method || 'GET').toUpperCase()) ? {'X-WCM-State-Delta':'1'} : {}),
                ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                ...options.headers
            }
        });
    } catch (error) {
        // Network errors supplied by browsers are implementation- and locale-dependent.
        // A deliberate abort should keep its original semantics.
        if (error?.name === 'AbortError') throw error;
        throw new Error(t('errors.api.network'), {cause: error});
    }
    const type = res.headers.get('content-type') || '';
    let data;
    try {
        data = type.includes('json') ? await res.json() : await res.text();
    } catch {
        data = null;
    }
    if (!res.ok) {
        throw httpResponseError(res.status, data);
    }
    if (data?.__wcmStateDelta === 1 && Array.isArray(data.updates)) {
        pendingUpdates.push(...data.updates);
        return data.result;
    }
    return data;
}

/** Also used by backup uploads/downloads that cannot use the JSON request helper. */
export function httpResponseError(status, data) {
    const key = typeof data?.errorCode === 'string' && /^api\.errors\.[a-zA-Z0-9]+$/.test(data.errorCode)
        ? data.errorCode : null;
    const params = data?.errorParams && typeof data.errorParams === 'object' && !Array.isArray(data.errorParams)
        ? Object.fromEntries(Object.entries(data.errorParams).filter(([name, value]) =>
            /^[a-zA-Z]\w*$/.test(name) && typeof value === 'string' && value.length <= 100)) : {};
    const translated = key && t(key, params);
    // Do not show untrusted or untranslated backend error strings.
    const message = translated && translated !== key ? translated : t('errors.api.generic', {status});
    const error = new Error(message);
    error.status = status;
    if (translated && translated !== key) error.code = key;
    return error;
}

/** Local validator cache. A 304 reuses parsed JSON instead of transmitting MBs.
 * API mutation results are never cached and an HTTP error never returns stale data. */
const validatedResponses = new Map();
const pendingUpdates = [];
/** Apply only deltas whose starting revision matches the last validated GET.
 * If another tab or restore intervenes, discard the local cache and GET again.
 * Never apply an unverified patch to the application state. */
export function takeMutationUpdates() {
    const updates = pendingUpdates.splice(0);
    const applied = new Set();
    for (const update of updates) {
        const kind = update?.delta?.kind;
        const url = kind === 'collection' ? '/api/collection' : kind === 'warehouse' ? '/api/warehouse' : null;
        if (!url) continue;
        const cache = validatedResponses.get(url);
        const baseline = kind === 'warehouse' ? cache?.storeEtag : cache?.etag;
        if (!cache || baseline !== update.before) {
            validatedResponses.delete(url);
            applied.delete(kind);
            continue;
        }
        try {
            const data = applyResourceDelta(cache.data, update.delta);
            // Warehouse's HTTP validator includes the collection revision too.
            // A later conditional GET will establish the new combined validator.
            validatedResponses.set(url, {data, etag: kind === 'collection' ? update.after : null,
                storeEtag: update.after});
            applied.add(kind);
        } catch {
            validatedResponses.delete(url);
            applied.delete(kind);
        }
    }
    return applied;
}
/** A validated cached resource can be reused immediately following its mutation.
 * Normal refreshes still revalidate with HTTP on the next request. */
export function takeUpdatedResource(kind, applied) {
    const url = kind === 'collection' ? '/api/collection' : '/api/warehouse';
    return applied.has(kind) && validatedResponses.has(url)
        ? structuredClone(validatedResponses.get(url).data) : null;
}
export async function requestCachedJson(url) {
    const previous = validatedResponses.get(url);
    const headers = previous?.etag ? {'If-None-Match': previous.etag} : {};
    let res;
    try {
        res = await fetch(url, {headers, cache: 'no-store'});
    } catch (error) {
        if (error?.name === 'AbortError') throw error;
        throw new Error(t('errors.api.network'), {cause: error});
    }
    if (res.status === 304 && previous) return structuredClone(previous.data);
    if (res.status === 304) {
        // Defensive recovery if a proxy supplied 304 before any local data exists.
        validatedResponses.delete(url);
        return requestCachedJson(url);
    }
    let data;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) throw httpResponseError(res.status, data);
    const etag = res.headers.get('etag');
    if (etag) validatedResponses.set(url, {etag, storeEtag: res.headers.get('x-wcm-store-etag') || etag, data: structuredClone(data)});
    else validatedResponses.delete(url);
    return data;
}
