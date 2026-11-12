import { t, currentLanguage } from '../i18n/index.js';
/** Analytics dashboard and six thematic pages. All datasets come from pure domain calculations. */
import { analyzeCollection, analyticsFilterOptions } from '../domain/analytics.js';
import { escapeHtml } from '../ui/dom.js';
import { readAnalyticsDate } from '../domain/analytics-period.js';
import { revealActiveTab } from '../ui/tab-navigation.js';
export { revealActiveTab as revealActiveAnalyticsTab };

export const ANALYSIS_PAGES = Object.freeze([
    { id: 'overview', get title() { return t("analytics.navigation.overview"); }, get sub() { return t("analytics.summary.highlights"); }, icon: '◫' },
    { id: 'inventory', get title() { return t("analytics.inventory.collectionStock"); }, get sub() { return t("analytics.inventory.sectionDescription"); }, icon: '▤' },
    { id: 'origins', get title() { return t("analytics.origin.title"); }, get sub() { return t("analytics.origin.sectionDescription"); }, icon: '◎' },
    { id: 'profile', get title() { return t("analytics.profile.title"); }, get sub() { return t("analytics.profile.sectionDescription"); }, icon: '◇' },
    { id: 'finance', get title() { return t("analytics.finance.title"); }, get sub() { return t("analytics.finance.pricesAndRetailers"); }, icon: '€' },
    { id: 'timeline', get title() { return t("analytics.trends.tastingSection"); }, get sub() { return t("analytics.trends.sectionDescription"); }, icon: '▥' },
    { id: 'quality', get title() { return t("analytics.quality.title"); }, get sub() { return t("analytics.quality.sectionDescription"); }, icon: '✓' },
]);
const number = v => Number.isFinite(v) ? new Intl.NumberFormat(currentLanguage(), { maximumFractionDigits: 1 }).format(v) : '–';
const money = (v, currency) => {
    if (!Number.isFinite(v)) return '–';
    if (currency === 'UNBEKANNT' || !/^[A-Z]{3}$/.test(currency)) return t("analytics.finance.unknownCurrency",{amount:number(v)});
    try { return new Intl.NumberFormat(currentLanguage(), { style: 'currency', currency, maximumFractionDigits: 2 }).format(v); }
    catch { return `${number(v)} ${currency}`; }
};
const CATEGORY_KEYS = Object.freeze({
  'Unbekannt':'analytics.category.unknown', 'NAS / unbekannt':'analytics.category.nasUnknown',
  '0–5 Jahre':'analytics.category.age0to5','6–10 Jahre':'analytics.category.age6to10',
  '11–15 Jahre':'analytics.category.age11to15','16–20 Jahre':'analytics.category.age16to20','21+ Jahre':'analytics.category.age21plus',
  'Unter 40 %':'analytics.category.abvBelow40','40–46 %':'analytics.category.abv40to46',
  'Über 46–50 %':'analytics.category.abv46to50','Über 50–60 %':'analytics.category.abv50to60','Über 60 %':'analytics.category.abvAbove60',
  'Vollständig':'analytics.category.complete','Unvollständig':'analytics.category.incomplete',
  'Verknüpft':'analytics.category.linked','Nicht verknüpft':'analytics.category.notLinked',
  'Originalabfüllung':'analytics.category.originalBottling','Unabhängige Abfüllung':'analytics.category.independentBottling',
  'Händler unbekannt':'analytics.category.merchantUnknown',
  'Geschlossen':'home.status.closed','Geöffnet':'analytics.inventory.openedStatus','Leer':'home.status.empty',
  'Standardflaschen':'home.inventory.standardBottles','Samples':'analytics.inventory.samples',
  'Nicht angegeben':'analytics.category.notSpecified','Andere / nicht eindeutig':'analytics.category.otherBottler',
  'Mit Notizen':'analytics.category.withNotes','Ohne Notizen':'analytics.category.withoutNotes',
  'Nicht klassifiziert':'analytics.category.notClassified',
  'Alter':'analytics.quality.missingAge','Alkoholgehalt':'analytics.quality.missingAbv',
  'Destillationsjahr':'analytics.quality.missingDistillationYear','Abfülljahr':'analytics.quality.missingBottlingYear',
  'Herkunft nicht zuordenbar':'analytics.quality.missingOrigin','Whiskyregion (Schottland)':'analytics.quality.missingScotchRegion',
  'Fasstyp':'analytics.quality.missingCask','Whiskytyp':'analytics.quality.missingWhiskyType',
  'Destillerie':'analytics.quality.missingDistillery','Kaufpreis':'analytics.quality.missingPurchasePrice',
  'Kaufdatum':'analytics.quality.missingPurchaseDate','Bewertung':'analytics.quality.missingRating',
});
const categoryLabel = label => CATEGORY_KEYS[label] ? t(CATEGORY_KEYS[label]) : label;
const COUNTRY_KEYS = Object.freeze({'Schottland':'countries.scotland','Vereinigtes Königreich':'countries.unitedKingdom','Deutschland':'countries.germany','Irland':'countries.ireland','Nordirland':'countries.northernIreland','USA':'countries.unitedStates','Mexiko':'countries.mexico','Schweden':'countries.sweden','Kanada':'countries.canada','Indien':'countries.india','Australien':'countries.australia','Frankreich':'countries.france','Belgien':'countries.belgium','Neuseeland':'countries.newZealand','Spanien':'countries.spain','Island':'countries.iceland','Tschechien':'countries.czechia','Südkorea':'countries.southKorea','Polen':'countries.poland','Schweiz':'countries.switzerland','Norwegen':'countries.norway','Italien':'countries.italy','Dänemark':'countries.denmark','Südafrika':'countries.southAfrica','Brasilien':'countries.brazil','Niederlande':'countries.netherlands','Finnland':'countries.finland','Wales':'countries.wales','England':'countries.england','Japan':'countries.japan','Taiwan':'countries.taiwan','China':'countries.china'});
const countryName = name => COUNTRY_KEYS[name] ? t(COUNTRY_KEYS[name]) : categoryLabel(name);
const safe = value => escapeHtml(value);
const empty = () => `<p class="analytics-empty">${t("analytics.empty.noMatchingData")}</p>`;

function panel(title, content, note = '', extra = '') {
    return `<section class="analytics-panel ${extra}"><h3>${safe(title)}</h3>${content}${note ? `<p class="analytics-note">${safe(note)}</p>` : ''}</section>`;
}
function metric(label, value, detail = '') {
    return `<div class="analytics-metric"><span>${safe(label)}</span><strong>${safe(value)}</strong>${detail ? `<small>${safe(detail)}</small>` : ''}</div>`;
}
function metricGrid(cards) { return `<div class="analytics-metrics">${cards.join('')}</div>`; }
function sectionHeading(text) { return `<h2 class="analytics-group-title">${safe(text)}</h2>`; }
function two(...items) { return `<div class="analytics-two">${items.join('')}</div>`; }
function rankBars(rows, { value = 'count', format = number, limit = 14, drill = false } = {}) {
    const data = rows.slice(0, limit);
    if (!data.length) return empty();
    const max = Math.max(1, ...data.map(row => Number(row[value]) || 0));
    return `<div class="analytics-bars" role="list">${data.map(row => {
        const width = Math.max(0, (Number(row[value]) || 0) / max * 100);
        const label = safe(categoryLabel(row.name));
        const title = safe(format(row[value], row.currency));
        const opener = drill && row.id !== undefined && row.id !== null && String(row.id).trim() ? `<button type="button" class="analytics-bar-label analytics-link" data-act="analytics-distillery" data-id="${safe(row.id)}" title="${t("analytics.filters.collectionByName", {name:label})}">${label}</button>` : `<span class="analytics-bar-label">${label}</span>`;
        return `<div class="analytics-bar-row" role="listitem">${opener}<div class="analytics-bar-track"><span style="width:${width.toFixed(2)}%"></span></div><strong>${title}</strong></div>`;
    }).join('')}</div>${rows.length > limit ? `<p class="analytics-note">${t("analytics.rankings.topEntries", {limit,total:rows.length})}</p>` : ''}`;
}
function composition(rows, { drill = null } = {}) {
    if (!rows.length || rows.every(row => !row.count)) return empty();
    const valid = rows.filter(r => r.count > 0);
    const total = valid.reduce((acc, r) => acc + r.count, 0);
    let angle = 0;
    const colors = ['#ba9258', '#3e789b', '#71967f', '#bd745f', '#8672a0', '#73a4a3', '#b29f77', '#a4777e'];
    const slices = valid.map((row, i) => {
        const from = angle;
        angle += row.count / total * 100;
        return `${colors[i % colors.length]} ${from.toFixed(2)}% ${angle.toFixed(2)}%`;
    });
    const legend = valid.map((row, i) => {
        const label = safe(row.displayName ?? categoryLabel(row.name));
        const count = `${number(row.count)} (${number(row.count / total * 100)} %)`;
        const action = drill && (drill.kind === 'country' || Object.hasOwn(drill, row.name)) ? ` data-act="analytics-drill-filter" data-kind="${safe(drill.kind)}" data-value="${safe(drill.kind === 'country' ? row.name : drill[row.name])}"` : '';
        return `<${action ? 'button type="button"' : 'div'} class="analytics-pie-item${action ? ' analytics-link' : ''}"${action}><i style="--slice:${colors[i % colors.length]}"></i><span>${label}</span><strong>${count}</strong></${action ? 'button' : 'div'}>`;
    }).join('');
    return `<div class="analytics-composition"><div class="analytics-donut" role="img" aria-label="${safe(valid.map(row => `${row.name}: ${row.count}`).join(', '))}" style="background:conic-gradient(${slices.join(',')})"><span>${number(total)}</span></div><div class="analytics-pie-legend">${legend}</div></div>`;
}
function detailsTable(headings, rows) {
    if (!rows.length) return empty();
    return `<div class="analytics-table-wrap"><table class="analytics-table"><thead><tr>${headings.map(h => `<th>${safe(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(cells => `<tr>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function bottlingLink(item, extra = '') {
    return `<button type="button" class="analytics-link" data-act="open" data-id="${safe(item.id)}"${item.bottleId ? ` data-bottle-id="${safe(item.bottleId)}"` : ''}>${safe(item.name)}</button>${extra}`;
}
function distilleryLink(item) {
    return `<button type="button" class="analytics-link" data-act="analytics-distillery" data-id="${safe(item.id)}">${safe(item.name)}</button>`;
}
function periodRows(rows, field = 'count', currency = '') {
    return rankBars([...rows].sort((a, b) => a.name.localeCompare(b.name, 'de')), {
        value: field, limit: 60, format: currency ? v => money(v, currency) : number,
    });
}
function timeChart(title, rows, state, { field = 'count', currency = '' } = {}) {
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
    const data = [...aggregate].sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, count: value }));
    return panel(title, data.length ? periodRows(data, 'count', currency) : empty(),
        !rows.length ? t("analytics.notes.validDatesOnly") : t("analytics.notes.dateRequiredForTimeline"));
}
function dateBoundary(boundary, value) {
    const caption = boundary === 'start' ? t("analytics.filters.from") : t("analytics.filters.until");
    return `<label class="analytics-date-boundary">${caption}<span class="analytics-date-control">
        <input type="date" id="analytics-${boundary}-date" data-analytics-boundary="${boundary}"
            aria-label="${t("analytics.filters.dateAccessibleName",{label:caption})}" value="${readAnalyticsDate(value)}" min="1600-01-01" max="2300-12-31">
        </span></label>`;
}
function periodControls(state) {
    const selected = state.analyticsPeriod || 'month';
    return `<div class="analytics-period" aria-label="${t("analytics.trends.granularity")}"><label>${t("analytics.filters.dateRange")} <select id="analytics-period"><option value="month" ${selected === 'month' ? 'selected' : ''}>${t("analytics.trends.monthly")}</option><option value="year" ${selected === 'year' ? ' selected' : ''}>${t("analytics.trends.yearly")}</option></select></label>
        ${dateBoundary('start', state.analyticsStartDate || '')}${dateBoundary('end', state.analyticsEndDate || '')}</div>`;
}

function inventory(analytics) {
    const { scope, inventory: inv } = analytics;
    return `${metricGrid([
        metric(t("analytics.inventory.bottlings"), number(scope.bottlings)), metric(t("analytics.inventory.physicalBottles"), number(scope.bottles)),
        metric(t("backups.summary.distilleriesLabel"), number(scope.distilleries)),
        metric(t("analytics.inventory.nominalVolume"), `${number(scope.volumeLitres)} l`, t("analytics.inventory.volumeKnown",{known:scope.knownVolumes,total:scope.bottles})),
    ])}${two(
        panel(t("forms.bottle.status"), composition(inv.status, { drill: { kind: 'status', Geschlossen: 'closed', Geöffnet: 'open', Leer: 'empty' } })),
        panel(t("analytics.inventory.standardAndSamples"), composition(inv.volumeTypes, { drill: { kind: 'volumeType', 'Standardflaschen': 'standard', Samples: 'sample' } })),
    )}`;
}
function provenance(analytics) {
    const d = analytics.provenance;
    return `${two(panel(t("analytics.rankings.topBottles"), rankBars(d.byDistilleryBottles, { value: 'bottles', drill: true }),
        t("analytics.notes.multiDistilleryBottleCounts")),
    panel(t("analytics.rankings.topBottlings"), rankBars(d.byDistilleryBottlings, { value: 'bottlings', drill: true }),
        t("analytics.notes.multipleDistilleryRanking")))}${two(
        panel(t("analytics.origin.countries"), composition(d.byCountry.map(row=>({...row,displayName:countryName(row.name)})), { drill: { kind: 'country' } }), t("analytics.notes.originAttribution")), panel(t("analytics.origin.whiskyRegions"), rankBars(d.byRegion)),
    )}${two(panel(t("analytics.profile.categories"), composition(d.byType)),
    panel(t("analytics.production.originalAndIndependentBottlers"), composition(d.byBottler),
        t("analytics.notes.originalBottlingClassification")))}`;
}
function profile(analytics) {
    const d = analytics.profile;
    const sortYears = rows => [...rows].sort((a, b) => a.name.localeCompare(b.name, 'de'));
    return `${two(panel(t("analytics.age.distribution"), rankBars(d.ageClasses), t("analytics.notes.nasAndMissingAge")),
    panel(t("analytics.age.title"), metricGrid([metric(t("analytics.statistics.average"), d.age.avg == null ? '–' : t("analytics.age.years",{count:number(d.age.avg)})), metric(t("analytics.age.youngest"), d.age.min == null ? '–' : t("analytics.age.years",{count:number(d.age.min)})), metric(t("analytics.age.oldest"), d.age.max == null ? '–' : t("analytics.age.years",{count:number(d.age.max)}))]), t("analytics.statistics.ageSampleCount", {count:d.age.count})))}
    ${two(panel(t("analytics.strength.bottlingCount"), rankBars(d.abvClasses)),
    panel(t("analytics.strength.title"), metricGrid([metric(t("analytics.statistics.average"), d.abv.avg == null ? '–' : `${number(d.abv.avg)} %`), metric(t("analytics.statistics.minimum"), d.abv.min == null ? '–' : `${number(d.abv.min)} %`), metric(t("analytics.statistics.maximum"), d.abv.max == null ? '–' : `${number(d.abv.max)} %`)]), t("analytics.statistics.abvSampleCount", {count:d.abv.count})))}
    ${two(panel(t("analytics.production.distillationYears"), rankBars(sortYears(d.distillationYears), { limit: 40 }), t("analytics.notes.distinctBottlingCount")),
    panel(t("analytics.production.bottlingYears"), rankBars(sortYears(d.bottlingYears), { limit: 40 }), t("analytics.notes.releaseYearNotBottlingYear")))}
    ${two(panel(t("analytics.casks.types"), rankBars(d.casks), t("analytics.notes.caskFieldsUnmodified")),
    panel(t("analytics.production.limitedEditions"), detailsTable([t("analytics.table.bottling"),t("analytics.table.edition")], d.edition.slice(0, 25).map(item => [bottlingLink(item), safe(number(item.value))])),
        t("analytics.notes.limitedEditionEligibility")))}`;
}
function finance(analytics, state) {
    const { finance: d, scope } = analytics;
    const byCurrency = d.prices.length ? d.prices : [];
    const main = byCurrency.length ? byCurrency.map(p => panel(t("analytics.finance.expensesByCurrency",{currency:p.currency}),
        metricGrid([metric(t("analytics.finance.recordedExpenses"), money(p.total, p.currency)),
            metric(t("analytics.statistics.average"), money(p.avg, p.currency)), metric(t("analytics.finance.cheapestPurchase"), money(p.min, p.currency)),
            metric(t("analytics.finance.mostExpensivePurchase"), money(p.max, p.currency)), metric(t("analytics.finance.pricePerLiter"), money(p.litrePrice, p.currency), t("analytics.finance.priceAndVolumeCount",{count:p.withVolumeCount}))]),
        t("analytics.statistics.documentedPriceCount", {count:p.count,total:scope.bottles}))).join('') : panel(t("analytics.finance.expensesPricesAndUnitPrices"), empty());
    const byPrices = d.mostExpensive.map(item => [bottlingLink(item), safe(money(item.price, item.currency))]);
    const costPages = [...new Set(d.byDistillery.map(row => row.currency))].map(currency => panel(t("analytics.finance.purchaseCostsByDistillery",{currency}),
        rankBars(d.byDistillery.filter(row => row.currency === currency), { value: 'total', format: v => money(v, currency), limit: 20, drill: true }),
        t("analytics.notes.multiDistilleryCosts")));
    const merchants = d.merchants.map(row => [safe(categoryLabel(row.name)), safe(row.currency), safe(number(row.count)), safe(money(row.total, row.currency))]);
    const priceCharts = byCurrency.map(p => timeChart(t("analytics.finance.purchaseCostsOverTime",{currency:p.currency}),
        d.costMonthly.filter(row => row.currency === p.currency), state, { field: 'total', currency: p.currency }));
    return `<p class="analytics-intro">${t("analytics.notes.documentedCostsNoCurrencyConversion")}</p>${main}${costPages.join('')}
    ${periodControls(state)}${priceCharts.join('')}${two(panel(t("analytics.finance.mostExpensiveBottlesByCurrency"), detailsTable([t("analytics.table.bottle"), t("analytics.table.price")], byPrices),
        t("analytics.notes.priceCurrencyComparison")),
        panel(t("forms.bottle.seller"), detailsTable([t("forms.bottle.seller"), t("analytics.table.currency"), t("analytics.table.purchases"), t("analytics.table.spending")], merchants),
            t("analytics.notes.purchasesWithPricesOnly")))}`;
}
function timeline(analytics, state) {
    const timelineData = analytics.timeline, rating = analytics.tasting;
    return `${periodControls(state)}${two(timeChart(t("analytics.statistics.recordedBottles"), timelineData.registeredDaily, state),
        timeChart(t("analytics.inventory.purchasedBottles"), timelineData.boughtDaily, state))}${timeChart(t("analytics.inventory.openedBottles"), timelineData.openedDaily, state)}
        ${two(panel(t("analytics.ratings.distribution"), rankBars(rating.histogram),
            t("analytics.ratings.averageSummary",{average:rating.rating.avg == null ? t("analytics.ratings.unrated") : `${number(rating.rating.avg)} / 100`,count:rating.rating.count})),
            panel(t("analytics.ratings.topBottles"), detailsTable([t("analytics.table.bottling"), t("analytics.table.rating")],
                rating.bestRated.map(item => [bottlingLink(item), `${number(item.rating)} / 100`]))))}
        ${two(panel(t("analytics.ratings.byDistillery"), rankBars(rating.byDistillery, { value: 'avg', drill: true }),
            t("analytics.notes.distilleryAverageRating")),
        panel(t("analytics.tasting.notes"), composition(rating.notes), t("analytics.notes.tastingNoteCoverage")))}`;
}
function quality(analytics) {
    const d = analytics.quality;
    const rows = entries => detailsTable([t("analytics.table.missingField"),t("analytics.table.count"),t("analytics.table.example")], entries.map(row => [
        safe(categoryLabel(row.name)), safe(number(row.count)), row.count && row.ids?.length
            ? `<button type="button" class="analytics-link" data-act="open" data-id="${safe(typeof row.ids[0] === 'string' ? row.ids[0] : row.ids[0].id)}"${typeof row.ids[0] === 'object' ? ` data-bottle-id="${safe(row.ids[0].bottleId)}"` : ''}>${t("analytics.actions.view")}</button>` : '–',
    ]));
    return `${two(panel(t("analytics.quality.completenessStatus"), composition(d.completion), t("analytics.notes.completenessSource")),
        panel(t("analytics.quality.whiskybaseReference"), composition(d.whiskybase)))}
        ${two(panel(t("analytics.quality.missingBottlingFields"), rows(d.missing),
            t("analytics.notes.missingFieldsCountedSeparately")),
        panel(t("analytics.quality.missingBottleFields"), rows(d.missingPurchase),
            t("analytics.notes.overlappingMissingFields")))}`;
}
function sectionCard(page, stat) {
    return `<button class="analytics-section-card" type="button" data-act="analytics-section" data-section="${safe(page.id)}"><span class="analytics-section-icon">${page.icon}</span><span><strong>${safe(page.title)}</strong><small>${safe(page.sub)}</small></span><span class="analytics-section-chevron" aria-hidden="true">›</span></button>`;
}
function overview(analytics) {
    const s = analytics.scope, p = analytics.provenance;
    const best = analytics.finance.prices.map(row => `${money(row.total, row.currency)}`).join(' · ') || t("analytics.finance.noPrices");
    return `${metricGrid([metric(t("analytics.inventory.bottlings"), number(s.bottlings)), metric(t("forms.bottle.plural"), number(s.bottles)),
        metric(t("backups.summary.distilleriesLabel"), number(s.distilleries)), metric(t("analytics.inventory.nominalVolume"), `${number(s.volumeLitres)} l`),
        metric(t("analytics.inventory.openedStatus"), number(analytics.inventory.status.find(v => v.name === 'Geöffnet')?.count || 0)),
        metric(t("analytics.inventory.samples"), number(analytics.inventory.volumeTypes.find(v => v.name === 'Samples')?.count || 0))])}
        ${two(panel(t("analytics.rankings.topDistilleries"), rankBars(p.byDistilleryBottles.slice(0, 8), { value: 'bottles', drill: true })),
            panel(t("forms.bottle.status"), composition(analytics.inventory.status, { drill: { kind: 'status', Geschlossen: 'closed', Geöffnet: 'open', Leer: 'empty' } })))}
        <div class="analytics-overview-note"><strong>${t("analytics.finance.recordedExpensesLabel")}</strong> ${safe(best)}<span> · ${t("analytics.statistics.priceCoverage", {priced:analytics.finance.priceCoverage,total:s.bottles})}</span></div>
        ${sectionHeading(t("analytics.sections.all"))}<div class="analytics-section-grid">${ANALYSIS_PAGES.slice(1).map(page => sectionCard(page)).join('')}</div>`;
}

function filterControls(state, options) {
    const filters = state.analyticsFilters || {};
    const select = (name, caption, options, selected) => `<select data-analytics-filter="${name}" aria-label="${safe(caption)}">${options.map(([value, label]) => `<option value="${safe(value)}"${value === selected ? ' selected' : ''}>${safe(label)}</option>`).join('')}</select>`;
    return `<div class="analytics-filters" aria-label="${t("analytics.filters.title")}">
        ${select('distillery', t('analytics.filters.distillery'), [['all', t('home.filters.allDistilleries')], ...options.distilleries.map(d => [d.id, d.name])], filters.distillery || 'all')}
        ${select('country', t('analytics.filters.country'), [['all', t('analytics.filters.allCountries')], ...options.countries.map(c => [c, countryName(c)])], filters.country || 'all')}
        ${select('volumeType', t('analytics.filters.bottleType'), [['all', t('home.filters.allBottleTypes')], ['standard', t('home.inventory.standardBottles')], ['sample', t('analytics.inventory.samples')]], filters.volumeType || 'all')}
        ${select('status', t('forms.bottle.status'), [['all', t('home.filters.allStatuses')], ['closed', t('home.status.closed')], ['open', t('analytics.inventory.openedStatus')], ['empty', t('home.status.empty')]], filters.status || 'all')}
        <button class="btn small" type="button" data-act="analytics-reset">${t("analytics.filters.reset")}</button></div>`;
}

export function createAnalyticsView({ state, shell }) {
    return function renderAnalytics() {
        const current = ANALYSIS_PAGES.find(p => p.id === state.selected) || ANALYSIS_PAGES[0];
        const data = analyzeCollection(state.collection, state.analyticsFilters);
        const options = analyticsFilterOptions(state.collection);
        const contents = {
            overview: () => overview(data), inventory: () => inventory(data), origins: () => provenance(data),
            profile: () => profile(data), finance: () => finance(data, state),
            timeline: () => timeline(data, state), quality: () => quality(data),
        };
        const nav = `<nav class="analytics-tabs" aria-label="${t("analytics.navigation.sections")}">${ANALYSIS_PAGES.map(page => `<button type="button" class="analytics-tab${page.id === current.id ? ' active' : ''}" data-act="analytics-section" data-section="${safe(page.id)}" aria-current="${page.id === current.id ? 'page' : 'false'}">${safe(page.title)}</button>`).join('')}</nav>`;
        shell(`<div class="analytics-page"><header class="analytics-header"><span class="eyebrow dark">${t("analytics.summary.eyebrow")}</span><h2>${t("navigation.analytics")}<span class="heading-period">.</span></h2><p>${safe(current.sub)}</p></header>
            ${nav}${filterControls(state, options)}<h2 class="analytics-section-title">${safe(current.title)}</h2>${contents[current.id]()}
            <p class="analytics-footnote">${t("analytics.notes.dataSourcePolicy")}</p></div>`);
        if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
            revealActiveTab(document.querySelector('.analytics-tabs'));
        }
    };
}
