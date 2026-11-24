/**
 * Browser preference only; never persisted in the collection JSON.
 *
 * @param {*} storage Storage adapter used to load or save preferences.
 * @return {*} Text assembled for the caller.
 */
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

/**
 * Resolves the visible theme from the stored preference and system setting.
 *
 * @param {*} preference Preference used by this operation.
 * @param {boolean=} systemDark System dark used by this operation.
 * @return {*} Result computed from the supplied inputs.
 */
export function effectiveTheme(preference, systemDark = false) {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }
  return systemDark ? 'dark' : 'light';
}

/**
 * Selects the next theme preference in the user's cycle.
 *
 * @param {boolean} active Active used by this operation.
 * @return {(string)} Result computed from the supplied inputs.
 */
export function nextTheme(active) {
  return active === 'dark' ? 'light' : 'dark';
}
