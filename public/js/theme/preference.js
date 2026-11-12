/** Browser preference only; never persisted in the collection JSON. */
export function getThemePreference(storage) {
    try {
        // Accessing localStorage itself can throw in restricted browser contexts.
        const source = storage === undefined ? globalThis.localStorage : storage;
        const value = source?.getItem('whisky-theme');
        return value === 'dark' || value === 'light' ? value : 'system';
    }
    catch {
        return 'system';
    }
}
export function effectiveTheme(preference, systemDark = false) {
    if (preference === 'light' || preference === 'dark') {
        return preference;
    }
    return systemDark ? 'dark' : 'light';
}
export function nextTheme(active) {
    return active === 'dark' ? 'light' : 'dark';
}
