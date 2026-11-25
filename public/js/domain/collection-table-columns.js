/** Browser-only table layout preferences, separately for bottlings and bottles.
 * All columns remain available even when omitted from the initial view. */
export const TABLE_COLUMNS = Object.freeze({
  bottlings: Object.freeze([
    {id: 'name', label: 'home.inventory.whisky', asc: 'name', desc: 'nameDesc'},
    {
      id: 'distillery',
      label: 'home.filters.distilleryOrBottler',
      asc: 'distillery',
      desc: 'distilleryDesc',
    },
    {
      id: 'age',
      label: 'analytics.age.title',
      asc: 'ageAsc',
      desc: 'age',
      first: 'desc',
    },
    {id: 'abv', label: 'home.filters.abv', asc: 'abvAsc', desc: 'abvDesc'},
    {
      id: 'year',
      label: 'home.filters.year',
      asc: 'yearAsc',
      desc: 'year',
      first: 'desc',
    },
    {
      id: 'stock',
      label: 'home.inventory.stock',
      asc: 'stockAsc',
      desc: 'stockDesc',
      first: 'desc',
    },
    {
      id: 'editing',
      label: 'home.status.editing',
      asc: 'completionAsc',
      desc: 'completionDesc',
    },
    {
      id: 'rating',
      label: 'home.table.rating',
      asc: 'scoreAsc',
      desc: 'scoreDesc',
      first: 'desc',
    },
    {
      id: 'price',
      label: 'home.table.averagePrice',
      asc: 'priceAsc',
      desc: 'priceDesc',
    },
    {
      id: 'updated',
      label: 'home.table.lastUpdated',
      asc: 'updatedAsc',
      desc: 'updatedDesc',
      first: 'desc',
    },
    {
      id: 'tasted',
      label: 'home.table.lastTasted',
      asc: 'tastedAsc',
      desc: 'tastedDesc',
      first: 'desc',
    },
  ]),
  bottles: Object.freeze([
    {id: 'name', label: 'home.inventory.whisky', asc: 'name', desc: 'nameDesc'},
    {
      id: 'inventory',
      label: 'forms.bottle.title',
      asc: 'inventoryAsc',
      desc: 'inventoryDesc',
    },
    {
      id: 'distillery',
      label: 'home.filters.distilleryOrBottler',
      asc: 'distillery',
      desc: 'distilleryDesc',
    },
    {
      id: 'age',
      label: 'analytics.age.title',
      asc: 'ageAsc',
      desc: 'age',
      first: 'desc',
    },
    {id: 'abv', label: 'home.filters.abv', asc: 'abvAsc', desc: 'abvDesc'},
    {
      id: 'status',
      label: 'forms.bottle.statusLabel',
      asc: 'statusAsc',
      desc: 'statusDesc',
    },
    {
      id: 'type',
      label: 'home.filters.type',
      asc: 'volumeTypeAsc',
      desc: 'volumeTypeDesc',
    },
    {
      id: 'size',
      label: 'home.filters.size',
      asc: 'volumeMlAsc',
      desc: 'volumeMlDesc',
    },
    {
      id: 'rating',
      label: 'home.table.rating',
      asc: 'scoreAsc',
      desc: 'scoreDesc',
      first: 'desc',
    },
    {
      id: 'price',
      label: 'home.table.price',
      asc: 'priceAsc',
      desc: 'priceDesc',
    },
    {
      id: 'updated',
      label: 'home.table.lastUpdated',
      asc: 'updatedAsc',
      desc: 'updatedDesc',
      first: 'desc',
    },
    {
      id: 'tasted',
      label: 'home.table.lastTasted',
      asc: 'tastedAsc',
      desc: 'tastedDesc',
      first: 'desc',
    },
  ]),
});

export const DEFAULT_TABLE_COLUMNS = Object.freeze({
  bottlings: Object.freeze(['name', 'distillery', 'age', 'abv', 'year',
    'stock', 'rating']),
  bottles: Object.freeze([
    'name',
    'inventory',
    'distillery',
    'age',
    'abv',
    'status',
    'type',
    'size',
    'rating',
  ]),
});
export const TABLE_COLUMNS_STORAGE_KEY = 'whisky-collection-table-columns-v1';

/**
 * Normalizes table columns for collection table columns.
 *
 * @param {*} mode Requested display mode or configuration variant.
 * @param {*} value Input value to process.
 * @return {*} Array of values selected for the caller.
 */
export function normalizeTableColumns(mode, value) {
  const options = TABLE_COLUMNS[mode];
  if (!options) return [];
  if (!Array.isArray(value)) return [...DEFAULT_TABLE_COLUMNS[mode]];
  const selected = new Set(value.filter(id => typeof id === 'string'));
  const allowed = options.map(column => column.id).filter(id => selected.has(id));
  return allowed.length ? allowed : [...DEFAULT_TABLE_COLUMNS[mode]];
}

/**
 * Loads table columns for collection table columns.
 *
 * @param {*} storage Storage adapter used to load or save preferences.
 * @return {!Object} Structured result for the caller.
 */
export function loadTableColumns(storage) {
  try {
    const source = storage === undefined ? globalThis.localStorage : storage;
    const value = JSON.parse(source?.getItem(TABLE_COLUMNS_STORAGE_KEY) || '{}');
    return {
      bottlings: normalizeTableColumns('bottlings', value?.bottlings),
      bottles: normalizeTableColumns('bottles', value?.bottles),
    };
  } catch {
    return {
      bottlings: [...DEFAULT_TABLE_COLUMNS.bottlings],
      bottles: [...DEFAULT_TABLE_COLUMNS.bottles],
    };
  }
}

/**
 * Updates table columns for collection table columns.
 *
 * @param {*} preferences Preferences to read, normalize or persist.
 * @param {*} storage Storage adapter used to load or save preferences.
 * @return {boolean} Whether the condition is satisfied.
 */
export function saveTableColumns(preferences, storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    if (!target) return false;
    target.setItem(TABLE_COLUMNS_STORAGE_KEY, JSON.stringify({
      bottlings: normalizeTableColumns('bottlings', preferences.bottlings),
      bottles: normalizeTableColumns('bottles', preferences.bottles),
    }));
    return true;
  } catch {return false;}
}

/**
 * Clicking an already sorted header reverses it, otherwise use its useful
 * default.
 *
 * @param {*} column Column definition used for layout and sorting.
 * @param {*} currentSort Current sorting key and direction.
 * @return {*} Result computed from the supplied inputs.
 */
export function sortForColumn(column, currentSort) {
  if (!column) return currentSort;
  if (currentSort === column.asc) return column.desc;
  if (currentSort === column.desc) return column.asc;
  return column.first === 'desc' ? column.desc : column.asc;
}
