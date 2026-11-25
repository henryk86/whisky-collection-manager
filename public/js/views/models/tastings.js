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
