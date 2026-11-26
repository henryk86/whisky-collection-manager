import {analyzeCollection, analyticsFilterOptions}
  from '../../domain/analytics.js';

/**
 * Prepares analytics presentation data without rendering or mutating state.
 * @param {!Object} state Current analytics filters.
 * @param {!ReadonlyArray<!Object>} pages Available analytics pages.
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

/**
 * Computes positive chart segments and cumulative percentage boundaries.
 * @param {!Array<!Object>} rows Category totals.
 * @return {!Object} Chart total and ordered segments.
 */
export function createCompositionViewModel(rows) {
  const valid = rows.filter(row => row.count > 0);
  const total = valid.reduce((sum, row) => sum + row.count, 0);
  let boundary = 0;
  const segments = valid.map(row => {
    const from = boundary;
    const percent = row.count / total * 100;
    boundary += percent;
    return {row, from, to: boundary, percent};
  });
  return {total, segments};
}

/**
 * Groups financial rankings and timeline entries by their actual currencies.
 * @param {!Object} finance Calculated finance statistics.
 * @return {!Object} Currency-specific rows for rankings and timelines.
 */
export function createFinanceViewModel(finance) {
  const byCurrency = finance.prices;
  return {
    byCurrency,
    distilleries: [...new Set(finance.byDistillery.map(row => row.currency))].map(currency => ({currency, rows: finance.byDistillery.filter(row => row.currency === currency)})),
    timelines: byCurrency.map(price => ({currency: price.currency, rows: finance.costMonthly.filter(row => row.currency === price.currency)})),
  };
}

/**
 * Orders year and period labels without mutating analytics records.
 * @param {!Array<!Object>} rows Named period totals.
 * @return {!Array<!Object>} Chronologically ordered records.
 */
export function sortAnalyticsPeriods(rows) {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
