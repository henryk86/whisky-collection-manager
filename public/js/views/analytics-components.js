import {createRankBarViewModel, aggregateAnalyticsPeriods, createCompositionViewModel, sortAnalyticsPeriods} from './models/analytics.js';
import {composeMarkup} from '../ui/render-plan.js';
import {headingTitle} from '../ui/headers.js';
import {t, currentLanguage} from '../i18n/index.js';
import {escapeHtml} from '../ui/dom.js';
import {emptyState, panel as contentPanel} from '../ui/content.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates('analytics/analytics.html');

/**
 * Derives the number numeric value from its input.
 *
 * @param {*} v Value to evaluate.
 * @return {string} Localized numeric label with at most one decimal place, or a dash for non-finite values.
 */
export const number = v => Number.isFinite(v) ? new Intl.NumberFormat(currentLanguage(), {maximumFractionDigits: 1}).format(v) : '–';

/**
 * Builds the localized money text for the current language.
 *
 * @param {*} v Value to evaluate.
 * @param {*} currency Value used by this operation.
 * @return {*} New instance constructed from the inputs.
 */
export const money = (v, currency) => {
  if (!Number.isFinite(v)) return '–';
  if (currency === 'UNBEKANNT' || !/^[A-Z]{3}$/.test(currency)) return t("analytics.finance.unknownCurrency", {amount: number(v)});
  try {
    return new Intl.NumberFormat(currentLanguage(), {style: 'currency', currency, maximumFractionDigits: 2}).format(v);
  }
  catch {return `${number(v)} ${currency}`;}
};

const CATEGORY_KEYS = Object.freeze({
  'Unbekannt': 'analytics.category.unknown',
  'NAS / unbekannt': 'analytics.category.nasUnknown',
  '0–5 Jahre': 'analytics.category.age0to5',
  '6–10 Jahre': 'analytics.category.age6to10',
  '11–15 Jahre': 'analytics.category.age11to15',
  '16–20 Jahre': 'analytics.category.age16to20',
  '21+ Jahre': 'analytics.category.age21plus',
  'Unter 40 %': 'analytics.category.abvBelow40',
  '40–46 %': 'analytics.category.abv40to46',
  'Über 46–50 %': 'analytics.category.abv46to50',
  'Über 50–60 %': 'analytics.category.abv50to60',
  'Über 60 %': 'analytics.category.abvAbove60',
  'Vollständig': 'analytics.category.complete',
  'Unvollständig': 'analytics.category.incomplete',
  'Verknüpft': 'analytics.category.linked',
  'Nicht verknüpft': 'analytics.category.notLinked',
  'Originalabfüllung': 'analytics.category.originalBottling',
  'Unabhängige Abfüllung': 'analytics.category.independentBottling',
  'Händler unbekannt': 'analytics.category.merchantUnknown',
  'Geschlossen': 'home.status.closed',
  'Geöffnet': 'analytics.inventory.openedStatus',
  'Leer': 'home.status.empty',
  'Standardflaschen': 'home.inventory.standardBottles',
  'Samples': 'analytics.inventory.samples',
  'Nicht angegeben': 'analytics.category.notSpecified',
  'Andere / nicht eindeutig': 'analytics.category.otherBottler',
  'Mit Notizen': 'analytics.category.withNotes',
  'Ohne Notizen': 'analytics.category.withoutNotes',
  'Nicht klassifiziert': 'analytics.category.notClassified',
  'Alter': 'analytics.quality.missingAge',
  'Alkoholgehalt': 'analytics.quality.missingAbv',
  'Destillationsjahr': 'analytics.quality.missingDistillationYear',
  'Abfülljahr': 'analytics.quality.missingBottlingYear',
  'Herkunft nicht zuordenbar': 'analytics.quality.missingOrigin',
  'Whiskyregion (Schottland)': 'analytics.quality.missingScotchRegion',
  'Fasstyp': 'analytics.quality.missingCask',
  'Whiskytyp': 'analytics.quality.missingWhiskyType',
  'Destillerie': 'analytics.quality.missingDistillery',
  'Kaufpreis': 'analytics.quality.missingPurchasePrice',
  'Kaufdatum': 'analytics.quality.missingPurchaseDate',
  'Bewertung': 'analytics.quality.missingRating',
});

/**
 * Derives the category label result from the supplied values.
 *
 * @param {*} label Label shown to the user.
 * @return {*} Result computed from the supplied inputs.
 */
export const categoryLabel = label => CATEGORY_KEYS[label] ? t(CATEGORY_KEYS[label]) : label;

const COUNTRY_KEYS = Object.freeze({
  'Schottland': 'countries.scotland',
  'Vereinigtes Königreich': 'countries.unitedKingdom',
  'Deutschland': 'countries.germany',
  'Irland': 'countries.ireland',
  'Nordirland': 'countries.northernIreland',
  'USA': 'countries.unitedStates',
  'Mexiko': 'countries.mexico',
  'Schweden': 'countries.sweden',
  'Kanada': 'countries.canada',
  'Indien': 'countries.india',
  'Australien': 'countries.australia',
  'Frankreich': 'countries.france',
  'Belgien': 'countries.belgium',
  'Neuseeland': 'countries.newZealand',
  'Spanien': 'countries.spain',
  'Island': 'countries.iceland',
  'Tschechien': 'countries.czechia',
  'Südkorea': 'countries.southKorea',
  'Polen': 'countries.poland',
  'Schweiz': 'countries.switzerland',
  'Norwegen': 'countries.norway',
  'Italien': 'countries.italy',
  'Dänemark': 'countries.denmark',
  'Südafrika': 'countries.southAfrica',
  'Brasilien': 'countries.brazil',
  'Niederlande': 'countries.netherlands',
  'Finnland': 'countries.finland',
  'Wales': 'countries.wales',
  'England': 'countries.england',
  'Japan': 'countries.japan',
  'Taiwan': 'countries.taiwan',
  'China': 'countries.china',
});

/**
 * Derives the country name result from the supplied values.
 *
 * @param {*} name Environment variable or setting name.
 * @return {*} Result computed from the supplied inputs.
 */
export const countryName = name => COUNTRY_KEYS[name] ? t(COUNTRY_KEYS[name]) : categoryLabel(name);

/**
 * Derives the safe result from the supplied values.
 *
 * @param {*} value Value to process.
 * @return {string} Escaped value for the renderer's compatibility binding.
 */
export const safe = value => escapeHtml(value);

/**
 * Prepares localized no-matching-data message.
 * @return {!import('../ui/render-plan.js').RenderPlan} Localized no-matching-data message.
 */
export const empty = () => emptyState({
  description: t("analytics.empty.noMatchingData"), variant: "inline",
});

/**
 * Prepares analytics section with a heading, content and optional explanatory note.
 *
 * @param {*} title Title displayed or stored by this operation.
 * @param {*} content Content to render, store or examine.
 * @param {string=} note Value used by this operation.
 * @param {string=} extra Additional context or configuration.
 * @return {!import('../ui/render-plan.js').RenderPlan} Analytics section with a heading, content and optional explanatory note.
 */
export function panel(title, content, note = '', extra = '') {
  return contentPanel({
    tag: 'section', variant: 'analytics', className: extra,
    content: composeMarkup(headingTitle({title}), content, note ? renderTemplate('analyticsNote', {note: safe(note), }) : ''),
  });
}

/**
 * Prepares analytics metric card with a value and optional detail.
 *
 * @param {*} label Label shown to the user.
 * @param {*} value Value to process.
 * @param {string=} detail Value used by this operation.
 * @return {!import('../ui/render-plan.js').RenderPlan} Analytics metric card with a value and optional detail.
 */
export function metric(label, value, detail = '') {
  return contentPanel({
    className: 'stat analytics-metric',
    content: renderTemplate('contentSpan', {
      label: safe(label),
      value: safe(value),
      small: detail ? renderTemplate('small', {detail: safe(detail), }) : '',
    }),
  });
}

/**
 * Prepares grid of metric cards.
 *
 * @param {*} cards Value used by this operation.
 * @return {!import('../ui/render-plan.js').RenderPlan} Grid of metric cards.
 */
export function metricGrid(cards) {
  return renderTemplate('stats', {cards: composeMarkup(cards), });
}

/**
 * Prepares second-level analytics group heading.
 *
 * @param {*} text Text to process.
 * @return {!import('../ui/render-plan.js').RenderPlan} Second-level analytics group heading.
 */
export function sectionHeading(text) {
  return headingTitle({
    title: text, level: 2,
    className: 'analytics-group-title',
  });
}

/**
 * Prepares two-column analytics layout containing the supplied panels.
 *
 * @param {!Array<*>} items Entries to process.
 * @return {!import('../ui/render-plan.js').RenderPlan} Two-column analytics layout containing the supplied panels.
 */
export function two(...items) {
  return renderTemplate('analyticsTwo', {items: composeMarkup(items), });
}

/**
 * Prepares ranked bars with relative widths, optional drill actions and truncation notice.
 *
 * @param {*} rows Input records to process.
 * @param {!Object=} options Options controlling the operation.
 * @return {!import('../ui/render-plan.js').RenderPlan} Ranked bars with relative widths, optional drill actions and truncation notice.
 */
export function rankBars(rows, {value = 'count', format = number, limit = 14,
  drill = false} = {}) {
  const {data, hasMore} = createRankBarViewModel(rows, value, limit);
  if (!data.length) return empty();
  return renderTemplate('analyticsBars', {
    data: composeMarkup(data.map(({row, width}) => {
      const label = safe(categoryLabel(row.name));
      const title = safe(format(row[value], row.currency));
      const opener = drill && row.id !== undefined && row.id !== null && String(row.id).trim() ?
        renderTemplate('analyticsDistillery', {
          id: safe(row.id),
          collectionByName: t("analytics.filters.collectionByName", {name: label}),
          label: label,
        }) : renderTemplate('analyticsBarLabel', {label: label, });
      return renderTemplate('analyticsBarRow', {
        opener: opener,
        toFixed: width.toFixed(2),
        title: title,
      });
    })),
    analyticsNote: hasMore ?
      renderTemplate('analyticsNote2', {
        topEntries: t("analytics.rankings.topEntries", {
          limit,
          total: rows.length,
        }),
      }) : '',
  });
}

/**
 * Prepares positive category composition chart and accessible legend.
 *
 * @param {*} rows Input records to process.
 * @param {!Object=} options Options controlling the operation.
 * @return {!import('../ui/render-plan.js').RenderPlan} Positive category composition chart and accessible legend.
 */
export function composition(rows, {drill = null} = {}) {
  const {total, segments} = createCompositionViewModel(rows);
  if (!segments.length) return empty();
  const colors = [
    '#ba9258',
    '#3e789b',
    '#71967f',
    '#bd745f',
    '#8672a0',
    '#73a4a3',
    '#b29f77',
    '#a4777e',
  ];
  const slices = segments.map(({from, to}, i) => `${colors[i % colors.length]} ${from.toFixed(2)}% ${to.toFixed(2)}%`);
  const legend = composeMarkup(segments.map(({row, percent}, i) => {
    const label = safe(row.displayName ?? categoryLabel(row.name));
    const count = `${number(row.count)} (${number(percent)} %)`;
    const action = drill && (drill.kind === 'country' || Object.hasOwn(drill, row.name)) ?
      {'data-act': 'analytics-drill-filter', 'data-kind': drill.kind, 'data-value': drill.kind === 'country' ? row.name : drill[row.name]} : null;
    return renderTemplate('legend', {
      action: action ? 'button' : 'div',
      typeAttributes: action ? {"type": "button"} : {},
      linkClass: action ? ' analytics-link' : '',
      linkAttributes: action || {},
      colors: colors[i % colors.length],
      label: label,
      count: count,
      closingTag: action ? 'button' : 'div',
    });
  }));
  return renderTemplate('analyticsComposition', {
    ariaLabel: safe(segments.map(({row}) => `${row.name}: ${row.count}`).join(', ')),
    slices: slices.join(','),
    number: number(total),
    legend: legend,
  });
}

/**
 * Prepares analytics table with column headings and supplied cell content.
 *
 * @param {*} headings Value used by this operation.
 * @param {*} rows Input records to process.
 * @return {!import('../ui/render-plan.js').RenderPlan} Analytics table with column headings and supplied cell content.
 */
export function detailsTable(headings, rows) {
  if (!rows.length) return empty();
  return renderTemplate('analyticsTableWrap', {
    headings: composeMarkup(headings.map(h => renderTemplate('th', {h: safe(h), }))),
    rows: composeMarkup(rows.map(cells => renderTemplate('tr', {cells: composeMarkup(cells.map(cell => renderTemplate('td', {cell: cell, }))), }))),
  });
}

/**
 * Prepares bottling navigation control with an optional physical-bottle target.
 *
 * @param {*} item Current item under consideration.
 * @param {string=} extra Additional context or configuration.
 * @return {!import('../ui/render-plan.js').RenderPlan} Bottling navigation control with an optional physical-bottle target.
 */
export function bottlingLink(item, extra = '') {
  return renderTemplate('open', {
    id: safe(item.id),
    dataBottleIdAttributes: item.bottleId ? {"data-bottle-id": item.bottleId} : {},
    name: safe(item.name),
    extra: extra,
  });
}

/**
 * Prepares distillery drill-down control.
 *
 * @param {*} item Current item under consideration.
 * @return {!import('../ui/render-plan.js').RenderPlan} Distillery drill-down control.
 */
export function distilleryLink(item) {
  return renderTemplate('analyticsDistillery2', {
    id: safe(item.id),
    name: safe(item.name),
  });
}

/**
 * Prepares chronologically sorted period bars with optional currency formatting.
 *
 * @param {*} rows Input records to process.
 * @param {string=} field Field definition or input value to handle.
 * @param {string=} currency Value used by this operation.
 * @return {!import('../ui/render-plan.js').RenderPlan} Chronologically sorted period bars with optional currency formatting.
 */
function periodRows(rows, field = 'count', currency = '') {
  return rankBars(
    sortAnalyticsPeriods(rows),
    {
      value: field,
      limit: 60,
      format: currency ? v => money(v, currency) : number,
    }
  );
}

/**
 * Prepares date-filtered and aggregated time-series panel.
 *
 * @param {*} title Title displayed or stored by this operation.
 * @param {*} rows Input records to process.
 * @param {*} state Current application state.
 * @param {!Object=} options Options controlling the operation.
 * @return {!import('../ui/render-plan.js').RenderPlan} Date-filtered and aggregated time-series panel.
 */
export function timeChart(title, rows, state, {field = 'count', currency = ''} = {}) {
  const data = aggregateAnalyticsPeriods(rows, state, field);
  return panel(
    title,
    data.length ? periodRows(data, 'count', currency) : empty(),
    !rows.length ? t("analytics.notes.validDatesOnly") : t("analytics.notes.dateRequiredForTimeline")
  );
}
