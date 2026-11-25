import {analyzeCollection, analyticsFilterOptions}
  from '../../domain/analytics.js';

/**
 * Prepares analytics presentation data without rendering or mutating state.
 * @param {!Object} state Current analytics filters.
 * @param {!Array<!Object>} pages Available analytics pages.
 * @return {!Object} Prepared presentation data.
 */
export function createAnalyticsViewModel(state, pages) {
  const current = pages.find(p => p.id === state.selected) || pages[0];
  // Timeline duration metrics follow the same selected end-date window as
  // the opened/emptied time series, while inventory filters stay global.
  const data = analyzeCollection(state.collection, {
    ...state.analyticsFilters,
    consumptionStartDate: state.analyticsStartDate || '',
    consumptionEndDate: state.analyticsEndDate || '',
  });
  const options = analyticsFilterOptions(state.collection);
  return {current, data, options};
}

/**
 * Calculates relative bar widths and truncation before chart rendering.
 * @param {!Array<!Object>} rows Sorted ranking records.
 * @param {string} value Numeric field to visualize.
 * @param {number} limit Maximum visible rows.
 * @return {!Object} Prepared rows with widths and truncation state.
 */
export function createRankBarViewModel(rows, value, limit) {
  const visible = rows.slice(0, limit);
  const maximum = Math.max(1, ...visible.map(row => Number(row[value]) || 0));
  return {
    data: visible.map(row => ({row, width: Math.max(0, (Number(row[value]) || 0) / maximum * 100)})),
    hasMore: rows.length > limit,
  };
}

/**
 * Aggregates dated entries within the selected reporting period.
 * @param {!Array<!Object>} rows Dated entries.
 * @param {!Object} state Selected period and date boundaries.
 * @param {string} field Numeric value to aggregate.
 * @return {!Array<!Object>} Chronologically ordered period totals.
 */
export function aggregateAnalyticsPeriods(rows, state, field) {
  const period = state.analyticsPeriod || 'month';
  const start = state.analyticsStartDate || '';
  const end = state.analyticsEndDate || '';
  const aggregate = new Map();
  rows.forEach(row => {
    if (start && row.name < start) return;
    if (end && row.name > end) return;
    const key = period === 'year' ? row.name.slice(0, 4) : row.name.slice(0, 7);
    aggregate.set(key, (aggregate.get(key) || 0) + (row[field] || 0));
  });
  const data = [...aggregate].sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({name, count: value}));
  return data;
}
