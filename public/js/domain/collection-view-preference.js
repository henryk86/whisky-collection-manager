/** Per-browser preference for how the collection overview is displayed. */
export const COLLECTION_VIEW_STORAGE_KEY = 'whisky-collection-view';

export function getCollectionViewPreference(storage) {
  try {
    const source = storage === undefined ? globalThis.localStorage : storage;
    return source?.getItem(COLLECTION_VIEW_STORAGE_KEY) === 'table' ? 'table' : 'cards';
  } catch {
    return 'cards';
  }
}

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
