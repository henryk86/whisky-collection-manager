/** Per-browser preference for how the collection overview is displayed. */
export const COLLECTION_VIEW_STORAGE_KEY = 'whisky-collection-view';

/**
 * Retrieves collection view preference for collection view preference.
 *
 * @param {*=} storage Storage adapter used to load or save preferences.
 * @return {(string)} Text assembled for the caller.
 */
export function getCollectionViewPreference(storage) {
  try {
    const source = storage === undefined ? globalThis.localStorage : storage;
    return source?.getItem(COLLECTION_VIEW_STORAGE_KEY) === 'table' ? 'table' : 'cards';
  } catch {
    return 'cards';
  }
}

/**
 * Updates collection view preference for collection view preference.
 *
 * @param {*} view Requested collection presentation, accepted only for cards or table.
 * @param {*=} storage Storage adapter used to load or save preferences.
 * @return {boolean} True if the collection view preference was saved successfully.
 */
export function saveCollectionViewPreference(view, storage) {
  if (view !== 'cards' && view !== 'table') return false;
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    if (!target) return false;
    target.setItem(COLLECTION_VIEW_STORAGE_KEY, view);
    return true;
  } catch {
    return false;
  }
}
