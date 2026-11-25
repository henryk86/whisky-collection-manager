import {emptyTastingNotes} from '../../../../shared/tasting.js';
import {allTastingReferences, flightEntries, flightForTasting} from '../../../../shared/tasting-flights.js';
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

/**
 * Returns the current local calendar date for date input defaults.
 * @return {string} Local date in YYYY-MM-DD format.
 */
export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Resolves the recorded members of a flight and the tastings eligible for attachment.
 * @param {!Object} collection Current collection.
 * @param {!Object} current Selected flight.
 * @return {!Object} Ordered recorded members and available tastings.
 */
export function createRecordedFlightViewModel(collection, current) {
  return {
    refs: flightEntries(collection, current),
    available: allTastingReferences(collection).filter(item => !flightForTasting(collection, item.record.id)).sort((a, b) => a.bottling.name.localeCompare(b.bottling.name)),
  };
}

/**
 * Resolves the tasting being edited, initial draft values and return navigation.
 * @param {!Object} state Current editor route and collection.
 * @return {!Object} Presentation data or a redirect for a missing record.
 */
export function createTastingEditorViewModel(state) {
  const external = state.page === 'external-tasting';
  const record = external ? allStandaloneTastings(state.collection || {}).find(x => x.id === state.selected) : null;
  const bottling = external ? (record?.bottling || {
    name: '', distillery: '', bottler: '', ageYears: null, abv: null, releaseYear: null,
  }) : state.collection?.bottlings?.find(b => b.id === state.selected);
  const draft = external ? state.selected === 'new' : state.tastingId === 'new';
  const existing = external ? record : (draft ? null : (bottling?.tastings || []).find(x => x.id === state.tastingId));
  if (!external && !bottling) return {redirect: {page: 'tastings-home', selected: null}};
  if (!draft && !existing) return {redirect: {page: external ? 'tastings-home' : 'tastings', selected: external ? null : bottling.id}};
  const value = existing || {
    tastedOn: localToday(), title: '', flavorProfile: null, tastingNotes: emptyTastingNotes(), rating: null, ratingComment: '', whiskyColor: null,
  };
  const flightBack = state.flightId && (state.collection?.tastingFlights || []).some(f => f.id === state.flightId && (draft || f.tastingIds.includes(existing?.id)));
  return {
    external, record, bottling, draft, existing, value, flightBack,
    backAction: flightBack ? 'tasting-back-flight' : (external ? 'tastings-back-home' : 'tastings-back-list'),
    backLabel: flightBack ? 'tastingFlights.backToFlight' : (external ? 'tastings.backHome' : 'tastings.backList'),
  };
}

/**
 * Prepares the records for a single bottling's tasting list.
 * @param {!Object} bottling Current bottling.
 * @return {!Object} Bottling and chronologically sorted tastings.
 */
export function createTastingListViewModel(bottling) {
  return {bottling, tastings: sortedTastings(bottling)};
}
