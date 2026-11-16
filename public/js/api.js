import { t } from './i18n/index.js';

/** All frontend HTTP requests use this helper for consistent localized response/error handling. */
export async function request(url, options = {}) {
    let res;
    try {
        res = await fetch(url, {
            ...options, headers: {
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
