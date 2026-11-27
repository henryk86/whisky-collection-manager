/**
 * Browser preference only; never persisted in the collection JSON.
 *
 * @param {*=} storage Storage adapter used to load or save preferences.
 * @return {'dark'|'light'|'system'} Stored preference or system when absent or inaccessible.
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
 * @param {*} preference Stored theme preference; any value other than light or dark follows the system.
 * @param {boolean=} systemDark Whether the operating system currently prefers dark mode.
 * @return {'dark'|'light'} Effective browser theme.
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
 * @param {string} active Currently effective theme, light or dark.
 * @return {'dark'|'light'} Alternate theme to activate.
 */
export function nextTheme(active) {
  return active === 'dark' ? 'light' : 'dark';
}
