import {DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS} from './pagination.js';

/** Per-browser display preference; never store it in collection.json. */
export const PAGE_SIZE_STORAGE_KEY = 'whisky-page-size';

/**
 * Accepts only a canonical numeric value from the supported page sizes.
 *
 * @param {*} value Stored preference or numeric input.
 * @return {?number} Supported page size, or null for obsolete or invalid input.
 */
function supportedPageSize(value) {
  const number = Number(value);
  return String(number) === String(value) && PAGE_SIZE_OPTIONS.includes(number) ? number : null;
}

/**
 * Recover safely when storage is unavailable or contains an obsolete value.
 *
 * @param {*} storage Storage adapter used to load or save preferences.
 * @return {number} Calculated numeric result.
 */
export function getPageSizePreference(storage) {
  try {
    const source = storage === undefined ? globalThis.localStorage : storage;
    return supportedPageSize(source?.getItem(PAGE_SIZE_STORAGE_KEY)) ?? DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

/**
 * Persist only values that can also be selected in the UI.
 *
 * @param {*} value Input value to process.
 * @param {*} storage Storage adapter used to load or save preferences.
 * @return {boolean} Whether the condition is satisfied.
 */
export function savePageSizePreference(value, storage) {
  const size = supportedPageSize(value);
  if (size === null) return false;
  try {
    const source = storage === undefined ? globalThis.localStorage : storage;
    if (!source) return false;
    source.setItem(PAGE_SIZE_STORAGE_KEY, String(size));
    return true;
  } catch {
    return false;
  }
}
