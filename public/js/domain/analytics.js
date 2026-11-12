/** Pure analytics over the existing schema-v4 collection. No storage writes, no inferred market values. */
import { whiskyTypeName } from './labels.js';
import { bottlingOrigins, bottlingDistilleryIds } from './distillery-origin.js';
import { readAnalyticsDate } from './analytics-period.js';

const isNumber = v => typeof v === 'number' && Number.isFinite(v);
const text = v => typeof v === 'string' && v.trim() ? v.trim() : '';
const usableYear = v => Number.isSafeInteger(v) && v >= 1600 && v <= 2300 ? v : null;
const yearOf = (v, explicit) => usableYear(explicit) ?? (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? usableYear(Number(v.slice(0, 4))) : null);
const currencyOf = b => text(b.currency).toUpperCase() || 'UNBEKANNT';
const idsOf = bottlingDistilleryIds;
const amount = v => isNumber(v) && v >= 0 ? v : null;
const dateMonth = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}(?:-\d{2})?(?:T.*)?$/.test(value)) return null;
    const month = Number(value.slice(5, 7));
    return month >= 1 && month <= 12 ? value.slice(0, 7) : null;
};
const dateDay = value => readAnalyticsDate(typeof value === 'string' ? value.slice(0, 10) : '');
const sum = values => values.reduce((a, b) => a + b, 0);
const avg = values => values.length ? sum(values) / values.length : null;
const validNumbers = (rows, getter) => rows.map(getter).filter(isNumber);
const grouped = (rows, key, { unknown = 'Unbekannt' } = {}) => {
    const counts = new Map();
    rows.forEach(row => { const label = text(key(row)) || unknown; counts.set(label, (counts.get(label) || 0) + 1); });
    return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'de'));
};
const rank = (rows, limit = 10) => rows.slice(0, limit);
const stats = values => ({ count: values.length, avg: avg(values), min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null });
const byDate = (rows, dateSelector) => grouped(rows.filter(row => dateMonth(dateSelector(row))), row => dateMonth(dateSelector(row)))
    .sort((a, b) => a.name.localeCompare(b.name));
const byDay = (rows, dateSelector) => grouped(rows.filter(row => dateDay(dateSelector(row))), row => dateDay(dateSelector(row)))
    .sort((a, b) => a.name.localeCompare(b.name));
const statusLabels = { closed: 'Geschlossen', open: 'Geöffnet', empty: 'Leer' };

/** Returns matching bottlings AND actual matching physical bottles. Bottle filters must match the same bottle. */
export function filterAnalyticsCollection(collection, filters = {}) {
    const distillery = filters.distillery || 'all';
    const country = filters.country || 'all';
    const volumeType = filters.volumeType || 'all';
    const status = filters.status || 'all';
    const distilleryLookup = new Map((collection.distilleries || []).map(d => [d.id, d]));
    const bottlings = [];
    const bottleEntries = [];
    for (const bottling of collection.bottlings || []) {
        if (distillery !== 'all' && !idsOf(bottling).includes(distillery)) continue;
        const origin = bottlingOrigins(bottling, distilleryLookup);
        if (country !== 'all' && !(origin.countries.length ? origin.countries : ['Unbekannt']).includes(country)) continue;
        const matching = (bottling.bottles || []).filter(bottle =>
            (volumeType === 'all' || (bottle.volumeType || 'standard') === volumeType)
            && (status === 'all' || bottle.status === status));
        if ((volumeType !== 'all' || status !== 'all') && !matching.length) continue;
        bottlings.push(bottling);
        matching.forEach(bottle => bottleEntries.push({ bottling, bottle }));
    }
    return { bottlings, bottleEntries, bottles: bottleEntries.map(entry => entry.bottle) };
}

export function analyticsFilterOptions(collection) {
    const used = new Set((collection.bottlings || []).flatMap(idsOf));
    const lookup = new Map((collection.distilleries || []).map(d => [d.id, d]));
    return {
        distilleries: (collection.distilleries || []).filter(d => used.has(d.id))
            .map(d => ({ id: d.id, name: d.name })).sort((a, b) => a.name.localeCompare(b.name, 'de')),
        countries: [...new Set((collection.bottlings || []).flatMap(b => {
            const origin = bottlingOrigins(b, lookup);
            return origin.countries.length ? origin.countries : ['Unbekannt'];
        }))].sort((a, b) => a.localeCompare(b, 'de')),
    };
}

export function analyzeCollection(collection, filters = {}) {
    const { bottlings, bottleEntries, bottles } = filterAnalyticsCollection(collection, filters);
    const distilleryNames = new Map((collection.distilleries || []).map(d => [d.id, d.name]));
    const distilleryLookup = new Map((collection.distilleries || []).map(d => [d.id, d]));
    const originFor = b => bottlingOrigins(b, distilleryLookup);
    const distilleryCounts = new Map();
    const bottlingPhysicalCounts = new Map();
    for (const { bottling } of bottleEntries) bottlingPhysicalCounts.set(bottling, (bottlingPhysicalCounts.get(bottling) || 0) + 1);
    for (const bottling of bottlings) for (const id of idsOf(bottling)) {
        const c = distilleryCounts.get(id) || { id, name: distilleryNames.get(id) || 'Unbekannt', bottlings: 0, bottles: 0, costs: new Map(), ratings: [] };
        c.bottlings++;
        c.bottles += bottlingPhysicalCounts.get(bottling) || 0;
        distilleryCounts.set(id, c);
    }
    const distilleries = [...distilleryCounts.values()];
    for (const { bottling, bottle } of bottleEntries) {
        for (const id of idsOf(bottling)) {
            const c = distilleryCounts.get(id);
            if (!c) continue;
            if (amount(bottle.purchasePrice) != null) {
                const currency = currencyOf(bottle);
                c.costs.set(currency, (c.costs.get(currency) || 0) + bottle.purchasePrice);
            }
            if (isNumber(bottle.rating)) c.ratings.push(bottle.rating);
        }
    }
    const sortDistilleries = field => [...distilleries].sort((a, b) => b[field] - a[field] || a.name.localeCompare(b.name, 'de'));
    const status = grouped(bottles, b => statusLabels[b.status] || 'Unbekannt');
    const volumeTypes = grouped(bottles, b => b.volumeType === 'sample' ? 'Samples' : 'Standardflaschen');
    const knownVolumes = validNumbers(bottles, b => b.volumeMl > 0 ? b.volumeMl : null);
    const age = validNumbers(bottlings, b => b.ageYears);
    const abv = validNumbers(bottlings, b => b.abv);
    const ageClasses = grouped(bottlings, b => !isNumber(b.ageYears) ? 'NAS / unbekannt' :
        b.ageYears <= 5 ? '0–5 Jahre' : b.ageYears <= 10 ? '6–10 Jahre' : b.ageYears <= 15 ? '11–15 Jahre' :
            b.ageYears <= 20 ? '16–20 Jahre' : '21+ Jahre');
    const abvClasses = grouped(bottlings, b => !isNumber(b.abv) ? 'Unbekannt' :
        b.abv < 40 ? 'Unter 40 %' : b.abv <= 46 ? '40–46 %' : b.abv <= 50 ? 'Über 46–50 %' :
            b.abv <= 60 ? 'Über 50–60 %' : 'Über 60 %');
    const distillationYears = grouped(bottlings, b => String(yearOf(b.distillationDate, b.distillationYear) || 'Unbekannt'));
    const bottlingYears = grouped(bottlings, b => String(yearOf(b.bottlingDate, b.bottlingYear) || 'Unbekannt'));
    const edition = bottlings.filter(b => isNumber(b.limitedEditionCount) && b.limitedEditionCount > 0)
        .map(b => ({ id: b.id, name: b.name, value: b.limitedEditionCount })).sort((a, b) => a.value - b.value);
    const priceEntries = bottleEntries.filter(({ bottle }) => amount(bottle.purchasePrice) != null);
    const byCurrency = new Map();
    for (const entry of priceEntries) {
        const currency = currencyOf(entry.bottle);
        if (!byCurrency.has(currency)) byCurrency.set(currency, []);
        byCurrency.get(currency).push(entry);
    }
    const financials = [...byCurrency].map(([currency, entries]) => {
        const prices = entries.map(e => e.bottle.purchasePrice);
        const withVolumes = entries.filter(e => isNumber(e.bottle.volumeMl) && e.bottle.volumeMl > 0);
        const litreVolume = sum(withVolumes.map(e => e.bottle.volumeMl)) / 1000;
        return { currency, count: entries.length, total: sum(prices), ...stats(prices),
            litrePrice: litreVolume ? sum(withVolumes.map(e => e.bottle.purchasePrice)) / litreVolume : null,
            withVolumeCount: withVolumes.length };
    }).sort((a, b) => a.currency.localeCompare(b.currency));
    const mostExpensive = [...byCurrency].flatMap(([currency, entries]) =>
        rank(entries.map(({ bottling, bottle }) => ({ id: bottling.id, bottleId: bottle.id,
            name: bottling.name, price: bottle.purchasePrice, currency }))
            .sort((a, b) => b.price - a.price))); // Top ten per currency; never compare currencies directly.
    const costsByDistillery = distilleries.flatMap(d => [...d.costs].map(([currency, total]) => ({
        id: d.id, name: d.name, currency, total,
    }))).sort((a, b) => a.currency.localeCompare(b.currency) || b.total - a.total);
    const costMonthly = [...byCurrency].flatMap(([currency, entries]) => byDate(entries, e => e.bottle.purchaseDate)
        .map(row => ({ ...row, currency, total: sum(entries.filter(e => dateMonth(e.bottle.purchaseDate) === row.name).map(e => e.bottle.purchasePrice)) })));
    const costDaily = [...byCurrency].flatMap(([currency, entries]) => byDay(entries, e => e.bottle.purchaseDate)
        .map(row => ({ ...row, currency, total: sum(entries.filter(e => dateDay(e.bottle.purchaseDate) === row.name).map(e => e.bottle.purchasePrice)) })));
    const merchants = [...byCurrency].flatMap(([currency, entries]) => {
        const map = new Map();
        entries.forEach(({ bottle }) => {
            const name = text(bottle.merchant) || 'Händler unbekannt';
            const row = map.get(name) || { name, currency, count: 0, total: 0 };
            row.count++; row.total += bottle.purchasePrice;
            map.set(name, row);
        });
        return [...map.values()];
    }).sort((a, b) => a.currency.localeCompare(b.currency) || b.count - a.count);
    const ratings = bottleEntries.filter(({ bottle }) => isNumber(bottle.rating) && bottle.rating >= 0 && bottle.rating <= 100);
    const rated = validNumbers(ratings, entry => entry.bottle.rating);
    const bestRated = rank(ratings.map(e => ({ id: e.bottling.id, bottleId: e.bottle.id, name: e.bottling.name, rating: e.bottle.rating }))
        .sort((a, b) => b.rating - a.rating));
    const distilleryRatings = distilleries.filter(d => d.ratings.length)
        .map(d => ({ id: d.id, name: d.name, count: d.ratings.length, avg: avg(d.ratings) }))
        .sort((a, b) => b.avg - a.avg || b.count - a.count);
    const hasNotes = bottle => ['nose', 'palate', 'finish'].some(key => text(bottle.tastingNotes?.[key]));
    const notesCount = bottles.filter(hasNotes).length;
    const missingField = [
        ['Alter', b => isNumber(b.ageYears)], ['Alkoholgehalt', b => isNumber(b.abv)],
        ['Destillationsjahr', b => !!yearOf(b.distillationDate, b.distillationYear)],
        ['Abfülljahr', b => !!yearOf(b.bottlingDate, b.bottlingYear)],
        ['Herkunft nicht zuordenbar', b => originFor(b).countries.length > 0],
        ['Whiskyregion (Schottland)', b => !originFor(b).countries.includes('Schottland') || originFor(b).regions.length > 0],
        ['Fasstyp', b => !!text(b.caskType)], ['Whiskytyp', b => !!text(b.whiskyType)],
        ['Destillerie', b => idsOf(b).length > 0],
    ];
    const missing = missingField.map(([name, has]) => ({ name, count: bottlings.filter(b => !has(b)).length,
        ids: bottlings.filter(b => !has(b)).map(b => b.id) })).sort((a, b) => b.count - a.count);
    const missingPurchase = [
        ['Kaufpreis', b => amount(b.purchasePrice) != null],
        ['Kaufdatum', b => !!dateMonth(b.purchaseDate)],
        ['Bewertung', b => isNumber(b.rating)],
    ].map(([name, has]) => ({ name, count: bottles.filter(b => !has(b)).length,
        ids: bottleEntries.filter(entry => !has(entry.bottle)).map(entry => ({ id: entry.bottling.id, bottleId: entry.bottle.id })) }));
    const complete = bottlings.filter(b => b.completionStatus === 'complete').length;
    const incomplete = bottlings.filter(b => b.completionStatus === 'incomplete').length;
    const baseConnected = bottlings.filter(b => !!text(b.whiskybaseUrl) || !!text(b.whiskybaseId)).length;
    const originalVsExternal = grouped(bottlings, b => {
        const bottler = text(b.bottler);
        if (!bottler) return 'Nicht angegeben';
        const normalized = name => text(name).normalize('NFKC').toLocaleLowerCase('de').replace(/\s+/g, ' ');
        if (['distillery bottling', 'original bottling', 'originalabfüllung', 'originalabfuellung'].includes(normalized(bottler))
            || idsOf(b).some(id => normalized(bottler) === normalized(distilleryNames.get(id)))) return 'Originalabfüllung';
        return 'Andere / nicht eindeutig';
    });
    const volumeKnown = knownVolumes.length;
    return {
        scope: { bottlings: bottlings.length, bottles: bottles.length, distilleries: distilleries.length,
            volumeLitres: sum(knownVolumes) / 1000, knownVolumes: volumeKnown },
        inventory: { status, volumeTypes },
        provenance: {
            byDistilleryBottles: rank(sortDistilleries('bottles')),
            byDistilleryBottlings: rank(sortDistilleries('bottlings')),
            byCountry: grouped(bottleEntries.flatMap(e => {
                const names = originFor(e.bottling).countries;
                return (names.length ? names : ['Unbekannt']).map(name => ({ name }));
            }), e => e.name),
            byRegion: grouped(bottleEntries.flatMap(e => {
                const names = originFor(e.bottling).regions;
                return (names.length ? names : ['Unbekannt']).map(name => ({ name }));
            }), e => e.name),
            byType: grouped(bottleEntries, e => whiskyTypeName(e.bottling) === 'Nicht angegeben' ? '' : whiskyTypeName(e.bottling)),
            byBottler: originalVsExternal,
        },
        profile: {
            ageClasses, age: stats(age), abvClasses, abv: stats(abv),
            distillationYears, bottlingYears, casks: grouped(bottlings, b => b.caskType), edition,
        },
        finance: { prices: financials, priceCoverage: priceEntries.length, byDistillery: costsByDistillery,
            costMonthly, costDaily, mostExpensive, merchants },
        timeline: {
            registered: byDate(bottleEntries, e => e.bottle.createdAt),
            bought: byDate(bottleEntries, e => e.bottle.purchaseDate),
            opened: byDate(bottleEntries, e => e.bottle.openedAt),
            registeredDaily: byDay(bottleEntries, e => e.bottle.createdAt),
            boughtDaily: byDay(bottleEntries, e => e.bottle.purchaseDate),
            openedDaily: byDay(bottleEntries, e => e.bottle.openedAt),
        },
        tasting: { rating: stats(rated), histogram: grouped(ratings, ({ bottle }) =>
            bottle.rating === 100 ? '100' : `${Math.floor(bottle.rating / 10) * 10}–${Math.floor(bottle.rating / 10) * 10 + 9}`),
            bestRated, byDistillery: distilleryRatings,
            notes: [{ name: 'Mit Notizen', count: notesCount }, { name: 'Ohne Notizen', count: bottles.length - notesCount }] },
        quality: {
            completion: [ { name: 'Vollständig', count: complete }, { name: 'Unvollständig', count: incomplete },
                { name: 'Nicht klassifiziert', count: bottlings.length - complete - incomplete } ],
            missing, whiskybase: [ { name: 'Verknüpft', count: baseConnected },
                { name: 'Nicht verknüpft', count: bottlings.length - baseConnected } ],
            missingPurchase,
        },
    };
}
