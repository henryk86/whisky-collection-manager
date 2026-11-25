import {t} from '../../i18n/index.js';
import {flightCandidates} from '../../domain/flight-planner.js';
import {storagePath} from '../../domain/warehouse-storage-path.js';
import {displayPhotoPath} from '../../../../shared/photo-images.js';
import {sortedTastings} from '../../../../shared/tasting-records.js';
import {allStandaloneTastings}
  from '../../../../shared/standalone-tastings.js';

/**
 * Prepares tastings presentation data without rendering or mutating state.
 * @param {!Object} state Current tasting collection.
 * @return {!Object} Prepared presentation data.
 */
export function createTastingIndexViewModel(state) {
  const owned = state.collection?.bottlings || [];
  const entries = [
    ...owned.flatMap(b => sortedTastings(b).map(record => ({record, b, external: false}))),
    ...allStandaloneTastings(state.collection || {}).map(record => ({record, b: record.bottling, external: true})),
  ].sort((a, b) => (b.record.tastedOn || '').localeCompare(a.record.tastedOn || '') ||
    (b.record.createdAt || '').localeCompare(a.record.createdAt || '') ||
    b.record.id.localeCompare(a.record.id));
  return {owned, entries};
}

/**
 * Resolves planned members, inventory availability, and eligible replacements.
 * @param {!Object} current Planned flight.
 * @param {!Object} collection Current collection.
 * @param {?Object} warehouse Storage assignments, if available.
 * @param {!Object} selectors Collection photo selectors.
 * @return {!Object} Prepared members and allowed actions.
 */
export function createPlannedFlightViewModel(current, collection, warehouse, selectors) {
  const editable = current.phase === 'planned';
  const candidates = flightCandidates(collection, {availability: 'all'});
  const selected = new Set(current.planItems.map(item => item.bottlingId));
  const members = current.planItems.map(item => {
    const b = collection?.bottlings?.find(bottling => bottling.id === item.bottlingId);
    const bottle = b?.bottles?.find(entry => entry.id === item.bottleId);
    return {
      item, b, bottle,
      label: b ? `${b.name}${bottle?.inventoryNumber ? ' · #' + bottle.inventoryNumber : ''}` : t('flightPlan.missing'),
      unavailable: !bottle || bottle.status === 'empty',
      photo: displayPhotoPath(bottle?.photos?.[0]) || (b ? selectors?.coverPhoto?.(b.id) : null),
      place: bottle && warehouse ? storagePath(warehouse, warehouse.assignments?.[bottle.id]) : null,
    };
  });
  /**
   * Provides unused candidates plus the member currently being replaced.
   * @param {string=} excludeId Bottling ID allowed for replacement.
   * @return {!Array<!Object>} Eligible candidates.
   */
  const choicesFor = (excludeId = '') => candidates.filter(candidate =>
    !selected.has(candidate.bottling.id) || candidate.bottling.id === excludeId);
  return {
    editable, members, choicesFor,
    canAdd: editable && choicesFor().length > 0 && members.length < 6,
    canStart: editable && members.length > 0 && members.every(member => !member.unavailable),
  };
}
