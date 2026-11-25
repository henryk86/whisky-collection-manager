import {t} from '../../i18n/index.js';
import {paginate} from '../../domain/pagination.js';
import {availableOverviewDistilleries, collectionOverviewEntries}
  from '../../domain/collection-overview.js';
import {TABLE_COLUMNS} from '../../domain/collection-table-columns.js';

/**
 * Prepares home presentation data without rendering or mutating state.
 * @param {!Object} state Current collection and filters.
 * @param {!Object} selectors Collection selectors.
 * @param {!Object} columnSelection Selected columns.
 * @return {!Object} Prepared presentation data.
 */
export function createCollectionViewModel(state, selectors, columnSelection) {
  const collection = state.collection;
  const {allBottles, distilleryNames} = selectors;
  const physical = allBottles();
  const total = physical.length, open = physical.filter(entry =>
    entry.status === 'open').length, closed = physical.filter(entry =>
      entry.status === 'closed').length;
  const establishedYear = collection.settings?.establishedYear;
  const mode = state.overviewMode === 'bottles' ? 'bottles' : 'bottlings';
  const selectedColumns = TABLE_COLUMNS[mode].filter(column =>
    columnSelection[mode].includes(column.id));
  const label = mode === 'bottles' ? t("forms.bottle.plural") :
    t("analytics.inventory.bottlings");
  const distilleries = availableOverviewDistilleries(collection);
  // Do not keep a deleted distillery selected after refreshing the
  // collection.
  const distillery = distilleries.some(item => item.id === state.distillery) ?
    state.distillery : 'all';
  // The mode changes the unit of filtering, counting and pagination, not the
  // collection data.
  const list = collectionOverviewEntries(collection, {
    mode,
    search: state.search,
    status: state.status,
    completion: state.completion,
    sort: state.sort,
    distillery,
    volumeType: state.volumeType,
    rating: state.rating,
    flavorCriteria: state.flavorCriteria,
    profileMissing: state.profileMissing,
    profilePresent: state.profilePresent,
    distilleryNames,
  });
  const pageSize = state.pageSize;
  const pageData = paginate(list, state.pageNumber, pageSize);
  return {
    collection, physical, total, open, closed, establishedYear, mode,
    selectedColumns, label, distilleries, distillery, list, pageSize, pageData,
  };
}
