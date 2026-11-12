/** Geographic origin is a property of the producing distilleries, never of a bottler.
 * Distilleries are the single source of truth; old bottling fields are read only
 * as a compatibility fallback if NO referenced distillery supplies metadata.
 */
const text = value => typeof value === 'string' ? value.trim() : '';
const countryNames = Object.freeze({
    'scotland': 'Schottland', 'schottland': 'Schottland',
    'united kingdom': 'Vereinigtes Königreich', 'uk': 'Vereinigtes Königreich', 'gb': 'Vereinigtes Königreich',
    'germany': 'Deutschland', 'deutschland': 'Deutschland', 'ireland': 'Irland', 'irland': 'Irland',
    'northern ireland': 'Nordirland', 'nordirland': 'Nordirland', 'united states': 'USA',
    'mexico': 'Mexiko', 'sweden': 'Schweden', 'canada': 'Kanada', 'india': 'Indien',
    'australia': 'Australien', 'france': 'Frankreich', 'belgium': 'Belgien',
    'new zealand': 'Neuseeland', 'spain': 'Spanien', 'iceland': 'Island',
    'czechia': 'Tschechien', 'south korea': 'Südkorea', 'poland': 'Polen',
    'switzerland': 'Schweiz', 'norway': 'Norwegen', 'italy': 'Italien',
    'denmark': 'Dänemark', 'south africa': 'Südafrika', 'brazil': 'Brasilien',
    'netherlands': 'Niederlande', 'finland': 'Finnland', 'wales': 'Wales',
    'england': 'England', 'japan': 'Japan', 'taiwan': 'Taiwan', 'china': 'China',
});
export function countryLabel(value) {
    const name = text(value);
    return countryNames[name.toLocaleLowerCase('en')] || name;
}
export function bottlingDistilleryIds(bottling) {
    return [...new Set(Array.isArray(bottling.distilleryIds) ? bottling.distilleryIds : bottling.distilleryId ? [bottling.distilleryId] : [])];
}
export function bottlingOrigins(bottling, distilleries = []) {
    const lookup = distilleries instanceof Map ? distilleries : new Map(distilleries.map(d => [d.id, d]));
    const countries = new Set(), regions = new Set();
    const ids = bottlingDistilleryIds(bottling);
    for (const id of ids) {
        const distillery = lookup.get(id);
        if (!distillery) continue;
        const country = countryLabel(distillery.country);
        const region = text(distillery.region);
        if (country) countries.add(country);
        if (region) regions.add(region);
    }
    // Backwards compatibility for old records without resolvable site metadata.
    // Once a site has a country, stale handwritten bottling origins cannot override it.
    if (!countries.size) {
        if (text(bottling.country)) countries.add(countryLabel(bottling.country));
        if (!regions.size && text(bottling.region)) regions.add(text(bottling.region));
    }
    return { countries: [...countries], regions: [...regions] };
}
export function bottlingCountryNames(bottling, distilleries) {
    return bottlingOrigins(bottling, distilleries).countries;
}
