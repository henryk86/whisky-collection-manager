import {displayedTastingRating, latestTasting} from '../../../../shared/tasting-records.js';
import {escapeHtml} from '../../ui/dom.js';
import {bottlingOriginLabel} from '../../domain/bottling-origin.js';
import {hasBottlingDetail} from '../../domain/bottling-details.js';
import {displayPhotoPath} from '../../../../shared/photo-images.js';
import {t} from '../../i18n/index.js';
import {paginate} from '../../domain/pagination.js';
import {availableOverviewDistilleries, collectionOverviewEntries, purchasePrice, latestUpdate}
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
  const total = physical.length, open = physical.filter(entry => entry.status === 'open').length, closed = physical.filter(entry => entry.status === 'closed').length;
  const establishedYear = collection.settings?.establishedYear;
  const mode = state.overviewMode === 'bottles' ? 'bottles' : 'bottlings';
  const selectedColumns = TABLE_COLUMNS[mode].filter(column => columnSelection[mode].includes(column.id));
  const label = mode === 'bottles' ? t("forms.bottle.plural") : t("analytics.inventory.bottlings");
  const distilleries = availableOverviewDistilleries(collection);
  // Do not keep a deleted distillery selected after refreshing the
  // collection.
  const distillery = distilleries.some(item => item.id === state.distillery) ? state.distillery : 'all';
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

/**
 * Prepares visible collection entries, photo precedence and summary fields.
 * @param {!Array<!Object>} entries Paginated collection entries.
 * @param {!Object} selectors Inventory and cover-photo selectors.
 * @return {!Array<!Object>} Presentation records for cards and table rows.
 */
export function createCollectionEntryModels(entries, selectors) {
  const {bottles, coverPhoto, distilleryNames} = selectors;
  return entries.map(({bottling, bottle}) => {
    const age = hasBottlingDetail(bottling.ageYears) ? t('home.facts.years', {count: bottling.ageYears}) : '';
    const abv = hasBottlingDetail(bottling.abv) ? `${bottling.abv} % Vol.` : '';
    const bottleAccessibleName = bottle ? t('home.image.bottleAccessibleName', {name: bottling.name, number: bottle.inventoryNumber || t('home.inventory.withoutInventoryNumber')}) : null;
    const bottleInfo = bottle ? [
      bottle.inventoryNumber ? `#${escapeHtml(bottle.inventoryNumber)}` : t('imports.bottles.noInventoryNumber'),
      bottle.volumeMl != null ? `${escapeHtml(bottle.volumeMl)} ml` : '',
    ].filter(Boolean).join(' · ') : '';
    const physicalBottles = bottle ? [bottle] : bottles(bottling.id);
    const origin = bottlingOriginLabel(bottling, distilleryNames);
    return {
      bottling, bottle, physicalBottles, origin,
      table: createCollectionTableModel({bottling, bottle}, physicalBottles, origin),
      age, abv,
      facts: [age, abv ? escapeHtml(abv) : ''].filter(Boolean).join(' · '),
      bottleInfo, bottleAccessibleName,
      photo: displayPhotoPath((bottle?.photos || [])[0]) || coverPhoto(bottling.id),
    };
  });
}

/**
 * Resolves the localized label for a physical bottle status.
 *
 * @param {string} status Physical bottle status.
 * @return {string} Localized status label.
 */
export const statusText = status => t(({
  closed: 'home.status.closed',
  open: 'analytics.inventory.openedStatus',
  empty: 'home.status.empty',
})[status] || 'features.distilleries.unknownStatus');

/**
 * Prepares the active filter labels displayed in the collection toolbar.
 * @param {!Object} state Current filter selections.
 * @param {!Array<!Object>} distilleries Available distilleries.
 * @return {!Array<!Array<*>>} Filter key, value label and category label.
 */
export function createActiveCollectionFilters(state, distilleries) {
  const distillery = distilleries.find(item => item.id === state.distillery);
  const rating = state.rating === 'unrated' ? t('home.filters.unrated') :
    ['1', '2', '3', '4', '5'].includes(state.rating) ? t(
      'home.filters.ratingRange',
      {
        from: state.rating === '1' ? '0' : `${(Number(state.rating) - 1) * 20},1`,
        to: Number(state.rating) * 20,
      }
    ) : null;
  return [
    [
      'status',
      state.status !== 'all' ? statusText(state.status) : null,
      t('forms.bottle.status'),
    ],
    [
      'completion',
      state.completion === 'complete' ? t('detail.status.complete') :
        state.completion === 'incomplete' ? t('detail.status.incomplete') : null,
      t('home.filters.completeness'),
    ],
    ['distillery', distillery?.name, t('home.filters.filterDistillery')],
    ['rating', rating, t('home.filters.filterRating')],
    [
      'volumeType',
      state.volumeType === 'sample' ?
        t('analytics.inventory.samples') : state.volumeType === 'standard' ? t('home.inventory.standardBottles') : null,
      t('home.filters.filterBottleType'),
    ],
    ...((state.flavorCriteria || []).map(item => [
      `flavor-axis:${item.axis}`,
      `${t(`flavor.axis.${item.axis}`)} ${item.min}–${item.max}`,
      t('collection.flavor.title'),
    ])),
    [
      'profileMissing',
      state.profileMissing ? t('collection.flavor.without') : null,
      t('collection.flavor.title'),
    ],
    [
      'profilePresent',
      state.profilePresent ? t('collection.flavor.with') : null,
      t('collection.flavor.title'),
    ],
  ].filter(([, value]) => value);
}

/**
 * Computes table values once per inventory entry instead of once per cell.
 * @param {!Object} entry Bottling and optional physical bottle.
 * @param {!Array<!Object>} displayedBottles Inventory represented by the row.
 * @param {string} origin Resolved distillery and origin label.
 * @return {!Object} Prepared table facts and source records.
 */
export function createCollectionTableModel(entry, displayedBottles, origin) {
  const {bottling, bottle} = entry;
  const score = displayedTastingRating(bottling);
  return {
    bottling, bottle, displayedBottles, origin, score: score != null && Number.isFinite(Number(score)) ? Number(score) : null,
    price: purchasePrice(entry), updated: latestUpdate(entry), tasted: latestTasting(bottling)?.tastedOn,
  };
}

/**
 * Calculates the five rating glass fills from a tasting score.
 * @param {!Object} bottling Bottling with tasting records.
 * @return {?Object} Clamped score and fill percentages, or null if unrated.
 */
export function createCollectionRatingModel(bottling) {
  const score = displayedTastingRating(bottling);
  if (score == null || !Number.isFinite(Number(score))) return null;
  const value = Math.min(100, Math.max(0, Number(score)));
  return {score: value, fills: Array.from({length: 5}, (_, i) => Math.max(0, Math.min(100, (value - i * 20) * 5)))};
}
