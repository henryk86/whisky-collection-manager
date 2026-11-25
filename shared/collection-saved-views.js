import {FLAVOR_AXES} from './flavor-profile.js';

export const VIEW_LIMIT = 40;
export const FLAVOR_CRITERIA_LIMIT = FLAVOR_AXES.length;
export const VIEW_FILTER_KEYS = Object.freeze([
  'search',
  'status',
  'completion',
  'distillery',
  'rating',
  'volumeType',
  'flavorCriteria',
  'profileMissing',
  'profilePresent',
]);
export const VIEW_DISPLAY_KEYS = Object.freeze(['sort', 'view', 'mode', 'columns']);

/**
 * Normalizes flavor criteria for collection saved views.
 *
 * @param {!Array<*>=} criteria Criteria used by this operation.
 * @return {!Array<!Object>} Resulting list of values.
 */
export function normalizeFlavorCriteria(criteria = []) {
  if (!Array.isArray(criteria) || criteria.length > FLAVOR_CRITERIA_LIMIT) throw new Error('Invalid flavor criteria');
  const seen = new Set();
  return criteria.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
      Object.keys(item).some(key => !['axis', 'min', 'max'].includes(key)) ||
      !FLAVOR_AXES.includes(item.axis) || seen.has(item.axis) ||
      !Number.isInteger(item.min) || !Number.isInteger(item.max) ||
      item.min < 0 || item.max > 10 || item.min > item.max)
      throw new Error('Invalid flavor criterion');
    seen.add(item.axis);
    return {axis: item.axis, min: item.min, max: item.max};
  });
}

/**
 * Normalizes saved views for collection saved views.
 *
 * @param {*} input Input to process.
 * @return {!Array<!Object>} Resulting list of values.
 */
export function normalizeSavedViews(input) {
  if (!Array.isArray(input) || input.length > VIEW_LIMIT) throw new Error('Invalid saved views');
  const ids = new Set();
  return input.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
      Object.keys(item).some(key => !['id', 'name', 'filters', 'display'].includes(key)) ||
      typeof item.id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(item.id) || ids.has(item.id) ||
      typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length > 80 ||
      !item.filters || typeof item.filters !== 'object' ||
      Array.isArray(item.filters) ||
      Object.keys(item.filters).some(key => !VIEW_FILTER_KEYS.includes(key)) ||
      !item.display || typeof item.display !== 'object' ||
      Array.isArray(item.display) ||
      Object.keys(item.display).some(key => !VIEW_DISPLAY_KEYS.includes(key))) throw new Error('Invalid saved view');
    ids.add(item.id);
    const f = item.filters, d = item.display;
    for (const key of ['search', 'status', 'completion', 'distillery',
      'rating', 'volumeType']) {
      if (typeof f[key] !== 'string' || f[key].length > 300) throw new Error('Invalid saved filter');
    }
    if (typeof f.profileMissing !== 'boolean' || (f.profilePresent !== undefined && typeof f.profilePresent !== 'boolean') ||
      (f.profileMissing && f.profilePresent)) throw new Error('Invalid profile filter');
    if (typeof d.sort !== 'string' || d.sort.length > 80 || !['cards', 'table'].includes(d.view) ||
      !['bottlings', 'bottles'].includes(d.mode) || !d.columns ||
      typeof d.columns !== 'object' || Array.isArray(d.columns) ||
      Object.keys(d.columns).some(key => !['bottlings', 'bottles'].includes(key)) ||
      !['bottlings', 'bottles'].every(key =>
        Array.isArray(d.columns[key]) && d.columns[key].length <= 20 &&
        d.columns[key].every(column => typeof column === 'string' && column.length <= 40))) throw new Error('Invalid saved display');
    return {
      id: item.id,
      name: item.name.trim(),
      filters: {
        ...f, flavorCriteria: normalizeFlavorCriteria(f.flavorCriteria),
      },
      display: {
        ...d,
        columns: {
          bottlings: [...d.columns.bottlings], bottles: [...d.columns.bottles],
        },
      },
    };
  });
}
