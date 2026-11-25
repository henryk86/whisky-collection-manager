import {composeMarkup} from '../ui/render-plan.js';
import {actionButton} from '../ui/buttons.js';
import {t} from '../i18n/index.js';
import {readAnalyticsDate} from '../domain/analytics-period.js';
import {loadTemplates} from '../ui/templates.js';
import {safe, countryName} from './analytics-components.js';

const renderTemplate = await loadTemplates('analytics/analytics.html');

/**
 * Builds the localized date boundary text for the current language.
 *
 * @param {*} boundary Value used by this operation.
 * @param {*} value Value to process.
 * @return {string} Resulting text.
 */
function dateBoundary(boundary, value) {
  const caption = boundary === 'start' ? t("analytics.filters.from") : t("analytics.filters.until");
  return renderTemplate('analyticsDateBoundary', {
    caption: caption,
    boundary: boundary,
    analyticsBoundary: boundary,
    dateAccessibleName: t("analytics.filters.dateAccessibleName", {label: caption}),
    readAnalyticsDate: readAnalyticsDate(value),
  });
}

/**
 * Builds the localized period controls text for the current language.
 *
 * @param {*} state Current application state.
 * @return {string} Resulting text.
 */
export function periodControls(state) {
  const selected = state.analyticsPeriod || 'month';
  return renderTemplate('analyticsPeriod', {
    monthAttributes: selected === 'month' ? {"selected": true} : {},
    yearAttributes: selected === 'year' ? {"selected": true} : {},
    dateBoundary: dateBoundary('start', state.analyticsStartDate || ''),
    endDateControl: dateBoundary('end', state.analyticsEndDate || ''),
  });
}

/**
 * Organizes controls for analytics.
 *
 * @param {!Object} state Current application state.
 * @param {!Object} options Optional configuration for the operation.
 * @return {string} Resulting text.
 */
export function filterControls(state, options) {
  const filters = state.analyticsFilters || {};
  /**
   * Transforms the entries used by select.
   *
   * @param {*} name Environment variable or setting name.
   * @param {*} caption Value used by this operation.
   * @param {*} options Options controlling the operation.
   * @param {*} selected Currently selected item or identifier.
   * @return {string} Resulting text.
   */
  const select = (name, caption, options, selected) =>
    renderTemplate('select', {
      name: name,
      ariaLabel: safe(caption),
      options: composeMarkup(options.map(([value, label]) => renderTemplate(
        'selectOption',
        {
          value: safe(value),
          selectedAttributes: value === selected ? {"selected": true} : {},
          label: safe(label),
        }
      ))),
    });
  return renderTemplate('analyticsFilters', {
    select: select(
      'distillery',
      t('analytics.filters.distillery'),
      [
        ['all', t('home.filters.allDistilleries')],
        ...options.distilleries.map(d => [d.id, d.name]),
      ],
      filters.distillery || 'all'
    ),
    countryFilter: select(
      'country',
      t('analytics.filters.country'),
      [
        ['all', t('analytics.filters.allCountries')],
        ...options.countries.map(c => [c, countryName(c)]),
      ],
      filters.country || 'all'
    ),
    volumeFilter: select(
      'volumeType',
      t('analytics.filters.bottleType'),
      [
        ['all', t('home.filters.allBottleTypes')],
        ['standard', t('home.inventory.standardBottles')],
        ['sample', t('analytics.inventory.samples')],
      ],
      filters.volumeType || 'all'
    ),
    statusFilter: select(
      'status',
      t('forms.bottle.status'),
      [
        ['all', t('home.filters.allStatuses')],
        ['closed', t('home.status.closed')],
        ['open', t('analytics.inventory.openedStatus')],
        ['empty', t('home.status.empty')],
      ],
      filters.status || 'all'
    ),
    analyticsResetButton: actionButton({
      label: t("analytics.filters.reset"),
      action: 'analytics-reset',
      size: 'small',
    }),
  });
}
