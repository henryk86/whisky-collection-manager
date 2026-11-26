import {whiskyTypeLabels} from './labels.js';
import {bottlingOrigins} from './distillery-origin.js';

/**
 * Only values actually entered for a bottling belong on its read-only detail
 * page.
 *
 * @param {*} value Input value to process.
 * @return {boolean} True if the supplied value belongs on the read-only detail page.
 */
export function hasBottlingDetail(value) {
  if (value == null) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.trim().length > 0 && value.trim() !== '–' && value.trim() !== '-';
  return false;
}

/**
 * Formats a full calendar date for display, preferring it over a year-only value.
 *
 * @param {*} date Full date, if recorded.
 * @param {*} year Year to display when the date is absent.
 * @return {*} Reformatted date or the original fallback year.
 */
function humanDate(date, year) {
  if (hasBottlingDetail(date)) {
    const parts = date.split('-');
    return parts.length === 3 ? parts.reverse().join('.') : date;
  }
  return year;
}

/**
 * Construct labels independently of the HTML view so empty values are never
 * rendered. compositionComplete=false is the default for unknown recipes, not
 * a confirmed "no". Keep numeric 0 as a supplied value; do not confuse it with
 * an empty field.
 *
 * @param {!Object} bottling Bottling record being processed.
 * @param {*} distilleryNames Lookup of distillery display names by identifier.
 * @param {!Array<*>=} distilleries Distillery catalog used to resolve origin information.
 * @return {!Array<!Array<*>>} Nonempty label-value pairs for the bottling details.
 */
export function bottlingDetails(bottling, distilleryNames, distilleries = []) {
  const ids = Array.isArray(bottling.distilleryIds)
    ? bottling.distilleryIds
    : (bottling.distilleryId ? [bottling.distilleryId] : []);

  const origin = bottlingOrigins(bottling, distilleries);
  const fields = [
    ['Whisky-Kategorie', whiskyTypeLabels[bottling.whiskyType]],
    ['Marke', bottling.brand],
    ['Beteiligte Destillerien', ids.length ? distilleryNames(bottling) : null],
    [
      'Zusammensetzung vollständig',
      bottling.compositionComplete === true ? 'Ja' : null,
    ],
    ['Alter', bottling.ageYears, 'Jahre'],
    ['Alkoholgehalt', bottling.abv, '% Vol.'],
    ['Erscheinungsjahr', bottling.releaseYear],
    ['Nennfüllmenge laut Abfüllung', bottling.volumeMl, 'ml'],
    ['Abfüller', bottling.bottler],
    ['Region', origin.regions.join(', ')],
    ['Land', origin.countries.join(', ')],
    ['Fasstyp', bottling.caskType],
    [
      'Destilliert am',
      humanDate(bottling.distillationDate, bottling.distillationYear),
    ],
    ['Abgefüllt am', humanDate(bottling.bottlingDate, bottling.bottlingYear)],
    ['Fassnummer', bottling.caskNumber],
    ['Limitierte Auflage', bottling.limitedEditionCount],
    ['Whiskybase-ID', bottling.whiskybaseId],
  ];

  return fields.filter(([, value]) => hasBottlingDetail(value));
}
