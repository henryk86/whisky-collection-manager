/** All frontend HTTP requests use this helper for consistent response/error handling. */
export async function request(url, options = {}) {
    const res = await fetch(url, {
        ...options, headers: {
            ...(options.body ? {
                'Content-Type': 'application/json'
            } : {}), ...options.headers
        }
    });
    const type = res.headers.get('content-type') || '';
    let data;
    try {
        data = type.includes('json') ? await res.json() : await res.text();
    }
    catch {
        data = null;
    }
    if (!res.ok) {
        throw Error(data?.error || `HTTP ${res.status}`);
    }
    return data;
}
