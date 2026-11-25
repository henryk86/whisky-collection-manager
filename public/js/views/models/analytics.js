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
