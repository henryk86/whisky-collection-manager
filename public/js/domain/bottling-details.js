import { whiskyTypeLabels } from './labels.js';
import { bottlingOrigins } from './distillery-origin.js';

/** Only values actually entered for a bottling belong on its read-only detail page. */
export function hasBottlingDetail(value) {
    if (value == null) return false;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'string') return value.trim().length > 0 && value.trim() !== '–' && value.trim() !== '-';
    return false;
}

function humanDate(date, year) {
    if (hasBottlingDetail(date)) {
        const parts = date.split('-');
        return parts.length === 3 ? parts.reverse().join('.') : date;
    }
    return year;
}

/**
 * Construct labels independently of the HTML view so empty values are never rendered.
 * compositionComplete=false is the default for unknown recipes, not a confirmed "no".
 * Keep numeric 0 as a supplied value; do not confuse it with an empty field.
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
        ['Zusammensetzung vollständig', bottling.compositionComplete === true ? 'Ja' : null],
        ['Alter', bottling.ageYears, 'Jahre'],
        ['Alkoholgehalt', bottling.abv, '% Vol.'],
        ['Erscheinungsjahr', bottling.releaseYear],
        ['Nennfüllmenge laut Abfüllung', bottling.volumeMl, 'ml'],
        ['Abfüller', bottling.bottler],
        ['Region', origin.regions.join(', ')],
        ['Land', origin.countries.join(', ')],
        ['Fasstyp', bottling.caskType],
        ['Destilliert am', humanDate(bottling.distillationDate, bottling.distillationYear)],
        ['Abgefüllt am', humanDate(bottling.bottlingDate, bottling.bottlingYear)],
        ['Fassnummer', bottling.caskNumber],
        ['Limitierte Auflage', bottling.limitedEditionCount],
    ];

    return fields.filter(([, value]) => hasBottlingDetail(value));
}
