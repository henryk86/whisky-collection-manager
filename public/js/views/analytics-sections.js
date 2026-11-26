import {createFinanceViewModel, sortAnalyticsPeriods} from './models/analytics.js';
import {periodControls} from './analytics-controls.js';
import {composeMarkup} from '../ui/render-plan.js';
import {t} from '../i18n/index.js';
import {chevronRightIcon} from '../ui/action-icons.js';
import {loadTemplates} from '../ui/templates.js';
import {number, money, categoryLabel, countryName, safe, empty, panel, metric, metricGrid, sectionHeading, two, rankBars, composition, detailsTable, bottlingLink, timeChart} from './analytics-components.js';

const renderTemplate = await loadTemplates('analytics/analytics.html');

/**
 * Prepares inventory analysis panels and stock breakdowns.
 *
 * @param {*} analytics Calculated analytics data for this view.
 * @return {import('../ui/render-plan.js').RenderPlan|string} Inventory analysis panels and stock breakdowns (or scalar/empty text when no plan is needed).
 */
export function inventory(analytics) {
  const {scope, inventory: inv} = analytics;
  return composeMarkup(metricGrid([
    metric(t("analytics.inventory.bottlings"), number(scope.bottlings)),
    metric(t("analytics.inventory.physicalBottles"), number(scope.bottles)),
    metric(t("backups.summary.distilleriesLabel"), number(scope.distilleries)),
    metric(
      t("analytics.inventory.nominalVolume"),
      `${number(scope.volumeLitres)} l`,
      t("analytics.inventory.volumeKnown", {known: scope.knownVolumes, total: scope.bottles})
    ),
  ]), two(
    panel(
      t("forms.bottle.status"),
      composition(
        inv.status,
        {
          drill: {
            kind: 'status',
            Geschlossen: 'closed',
            Geöffnet: 'open',
            Leer: 'empty',
          },
        }
      )
    ),
    panel(
      t("analytics.inventory.standardAndSamples"),
      composition(
        inv.volumeTypes,
        {
          drill: {
            kind: 'volumeType',
            'Standardflaschen': 'standard',
            Samples: 'sample',
          },
        }
      )
    ),
  ));
}

/**
 * Prepares origin and distillery analysis panels.
 *
 * @param {*} analytics Calculated analytics data for this view.
 * @return {import('../ui/render-plan.js').RenderPlan|string} Origin and distillery analysis panels (or scalar/empty text when no plan is needed).
 */
export function provenance(analytics) {
  const d = analytics.provenance;
  return composeMarkup(two(
    panel(
      t("analytics.rankings.topBottles"),
      rankBars(d.byDistilleryBottles, {value: 'bottles', drill: true}),
      t("analytics.notes.multiDistilleryBottleCounts")
    ),
    panel(
      t("analytics.rankings.topBottlings"),
      rankBars(d.byDistilleryBottlings, {value: 'bottlings', drill: true}),
      t("analytics.notes.multipleDistilleryRanking")
    )
  ), two(
    panel(
      t("analytics.origin.countries"),
      composition(d.byCountry.map(row => ({...row, displayName: countryName(row.name)})), {drill: {kind: 'country'}}),
      t("analytics.notes.originAttribution")
    ),
    panel(t("analytics.origin.whiskyRegions"), rankBars(d.byRegion)),
  ), two(panel(t("analytics.profile.categories"), composition(d.byType)),
    panel(
      t("analytics.production.originalAndIndependentBottlers"),
      composition(d.byBottler),
      t("analytics.notes.originalBottlingClassification")
    )));
}

/**
 * Prepares whisky composition and tasting profile panels.
 *
 * @param {*} analytics Calculated analytics data for this view.
 * @return {import('../ui/render-plan.js').RenderPlan|string} Whisky composition and tasting profile panels (or scalar/empty text when no plan is needed).
 */
export function profile(analytics) {
  const d = analytics.profile;
  return composeMarkup(
    two(
      panel(t("analytics.age.distribution"), rankBars(d.ageClasses), t("analytics.notes.nasAndMissingAge")),
      panel(
        t("analytics.age.title"),
        metricGrid([
          metric(
            t("analytics.statistics.average"),
            d.age.avg == null ? '–' : t("analytics.age.years", {count: number(d.age.avg)})
          ),
          metric(
            t("analytics.age.youngest"),
            d.age.min == null ? '–' : t("analytics.age.years", {count: number(d.age.min)})
          ),
          metric(t("analytics.age.oldest"), d.age.max == null ? '–' : t("analytics.age.years", {count: number(d.age.max)})),
        ]),
        t("analytics.statistics.ageSampleCount", {count: d.age.count})
      )
    ),
    "\n    ",
    two(
      panel(t("analytics.strength.bottlingCount"), rankBars(d.abvClasses)),
      panel(
        t("analytics.strength.title"),
        metricGrid([
          metric(t("analytics.statistics.average"), d.abv.avg == null ? '–' : `${number(d.abv.avg)} %`),
          metric(t("analytics.statistics.minimum"), d.abv.min == null ? '–' : `${number(d.abv.min)} %`),
          metric(t("analytics.statistics.maximum"), d.abv.max == null ? '–' : `${number(d.abv.max)} %`),
        ]),
        t("analytics.statistics.abvSampleCount", {count: d.abv.count})
      )
    ),
    "\n    ",
    two(
      panel(
        t("analytics.production.distillationYears"),
        rankBars(sortAnalyticsPeriods(d.distillationYears), {limit: 40}),
        t("analytics.notes.distinctBottlingCount")
      ),
      panel(
        t("analytics.production.bottlingYears"),
        rankBars(sortAnalyticsPeriods(d.bottlingYears), {limit: 40}),
        t("analytics.notes.releaseYearNotBottlingYear")
      )
    ),
    "\n    ",
    two(
      panel(t("analytics.casks.types"), rankBars(d.casks), t("analytics.notes.caskFieldsUnmodified")),
      panel(
        t("analytics.production.limitedEditions"),
        detailsTable(
          [t("analytics.table.bottling"), t("analytics.table.edition")],
          d.edition.slice(0, 25).map(item => [bottlingLink(item), safe(number(item.value))])
        ),
        t("analytics.notes.limitedEditionEligibility")
      )
    )
  );
}

/**
 * Prepares financial analysis grouped by currency.
 *
 * @param {*} analytics Calculated analytics data for this view.
 * @param {*} state Current application state.
 * @return {!import('../ui/render-plan.js').RenderPlan} Financial analysis grouped by currency.
 */
export function finance(analytics, state) {
  const {finance: d, scope} = analytics;
  const {byCurrency, distilleries, timelines} = createFinanceViewModel(d);
  const main = byCurrency.length ? composeMarkup(byCurrency.map(p => panel(
    t("analytics.finance.expensesByCurrency", {currency: p.currency}),
    metricGrid([
      metric(t("analytics.finance.recordedExpenses"), money(p.total, p.currency)),
      metric(t("analytics.statistics.average"), money(p.avg, p.currency)),
      metric(t("analytics.finance.cheapestPurchase"), money(p.min, p.currency)),
      metric(t("analytics.finance.mostExpensivePurchase"), money(p.max, p.currency)),
      metric(
        t("analytics.finance.pricePerLiter"),
        money(p.litrePrice, p.currency),
        t("analytics.finance.priceAndVolumeCount", {count: p.withVolumeCount})
      ),
    ]),
    t("analytics.statistics.documentedPriceCount", {count: p.count, total: scope.bottles})
  ))) : panel(t("analytics.finance.expensesPricesAndUnitPrices"), empty());
  const byPrices = d.mostExpensive.map(item => [bottlingLink(item), safe(money(item.price, item.currency))]);
  const costPages = distilleries.map(({currency, rows}) => panel(
    t("analytics.finance.purchaseCostsByDistillery", {currency}),
    rankBars(
      rows,
      {
        value: 'total',
        /**
         * Derives the format result from the supplied values.
         *
         * @param {*} v Value to evaluate.
         * @return {*} Result computed from the supplied inputs.
         */
        format: v =>
          money(v, currency), limit: 20, drill: true,
      }
    ),
    t("analytics.notes.multiDistilleryCosts")
  ));
  const merchants = d.merchants.map(row => [
    safe(categoryLabel(row.name)),
    safe(row.currency),
    safe(number(row.count)),
    safe(money(row.total, row.currency)),
  ]);
  const priceCharts = timelines.map(({currency, rows}) => timeChart(
    t("analytics.finance.purchaseCostsOverTime", {currency}),
    rows,
    state,
    {field: 'total', currency}
  ));
  return renderTemplate('analyticsIntro', {
    main: main,
    costPages: composeMarkup(costPages),
    periodControls: periodControls(state),
    priceCharts: composeMarkup(priceCharts),
    two: two(
      panel(
        t("analytics.finance.mostExpensiveBottlesByCurrency"),
        detailsTable([t("analytics.table.bottle"), t("analytics.table.price")], byPrices),
        t("analytics.notes.priceCurrencyComparison")
      ),
      panel(
        t("forms.bottle.seller"),
        detailsTable(
          [
            t("forms.bottle.seller"),
            t("analytics.table.currency"),
            t("analytics.table.purchases"),
            t("analytics.table.spending"),
          ],
          merchants
        ),
        t("analytics.notes.purchasesWithPricesOnly")
      )
    ),
  });
}

/**
 * Prepares collection and consumption time-series panels.
 *
 * @param {*} analytics Calculated analytics data for this view.
 * @param {*} state Current application state.
 * @return {import('../ui/render-plan.js').RenderPlan|string} Collection and consumption time-series panels (or scalar/empty text when no plan is needed).
 */
export function timeline(analytics, state) {
  const timelineData = analytics.timeline, rating = analytics.tasting, duration = analytics.consumption;
  /**
   * Builds the localized days text for the current language.
   *
   * @param {*} value Value to process.
   * @return {*} Result computed from the supplied inputs.
   */
  const days = value => value == null ? '–' : t('analytics.consumption.days', {count: number(value)});
  return composeMarkup(
    periodControls(state),
    two(
      timeChart(t("analytics.statistics.recordedBottles"), timelineData.registeredDaily, state),
      timeChart(t("analytics.inventory.purchasedBottles"), timelineData.boughtDaily, state)
    ),
    "\n        ",
    two(
      timeChart(t("analytics.inventory.openedBottles"), timelineData.openedDaily, state),
      timeChart(t("analytics.consumption.emptiedBottles"), timelineData.emptiedDaily, state)
    ),
    "\n        ",
    panel(
      t('analytics.consumption.title'),
      metricGrid([
        metric(t('analytics.statistics.average'), days(duration.avg)),
        metric(t('analytics.statistics.minimum'), days(duration.min)),
        metric(t('analytics.statistics.maximum'), days(duration.max)),
      ]),
      t('analytics.consumption.eligibility', {count: duration.count})
    ),
    "\n        ",
    two(
      panel(
        t("analytics.ratings.distribution"),
        rankBars(rating.histogram),
        t(
          "analytics.ratings.averageSummary",
          {
            average: rating.rating.avg == null ? t("analytics.ratings.unrated") : `${number(rating.rating.avg)} / 100`,
            count: rating.rating.count,
          }
        )
      ),
      panel(
        t("analytics.ratings.topBottles"),
        detailsTable(
          [t("analytics.table.bottling"), t("analytics.table.rating")],
          rating.bestRated.map(item => [bottlingLink(item), `${number(item.rating)} / 100`])
        )
      )
    ),
    "\n        ",
    two(
      panel(
        t("analytics.ratings.byDistillery"),
        rankBars(rating.byDistillery, {value: 'avg', drill: true}),
        t("analytics.notes.distilleryAverageRating")
      ),
      panel(t("analytics.tasting.notes"), composition(rating.notes), t("analytics.notes.tastingNoteCoverage"))
    )
  );
}

/**
 * Prepares metadata completeness and missing-data panels.
 *
 * @param {*} analytics Calculated analytics data for this view.
 * @return {import('../ui/render-plan.js').RenderPlan|string} Metadata completeness and missing-data panels (or scalar/empty text when no plan is needed).
 */
export function quality(analytics) {
  const d = analytics.quality;
  /**
   * Prepares table rows for the supplied overview data.
   *
   * @param {*} entries Value used by this operation.
   * @return {!import('../ui/render-plan.js').RenderPlan} Table rows for the supplied overview data.
   */
  const rows = entries => detailsTable(
    [
      t("analytics.table.missingField"),
      t("analytics.table.count"),
      t("analytics.table.example"),
    ],
    entries.map(row => [
      safe(categoryLabel(row.name)),
      safe(number(row.count)),
      row.count && row.ids?.length
        ? renderTemplate('open2', {
          id: safe(typeof row.ids[0] === 'string' ? row.ids[0] : row.ids[0].id),
          objectAttributes: typeof row.ids[0] === 'object' ? {"data-bottle-id": row.ids[0].bottleId} : {},
        }) : '–',
    ])
  );
  return composeMarkup(two(
    panel(
      t("analytics.quality.completenessStatus"),
      composition(d.completion),
      t("analytics.notes.completenessSource")
    ),
    panel(t("analytics.quality.whiskybaseReference"), composition(d.whiskybase))
  ), "\n        ", two(
    panel(
      t("analytics.quality.missingBottlingFields"),
      rows(d.missing),
      t("analytics.notes.missingFieldsCountedSeparately")
    ),
    panel(t("analytics.quality.missingBottleFields"), rows(d.missingPurchase),
      t("analytics.notes.overlappingMissingFields"))
  ));
}

/**
 * Prepares overview navigation card for an analysis section.
 *
 * @param {*} page Page or view being rendered or selected.
 * @param {*} stat Value used by this operation.
 * @return {!import('../ui/render-plan.js').RenderPlan} Overview navigation card for an analysis section.
 */
function sectionCard(page, stat) {
  return renderTemplate('analyticsSection', {
    section: safe(page.id),
    icon: page.icon,
    title: safe(page.title),
    sub: safe(page.sub),
    chevronRightIcon: chevronRightIcon,
  });
}

/**
 * Prepares analytics overview with key metrics and section navigation.
 *
 * @param {*} analytics Calculated analytics data for this view.
 * @param {!Array<!Object>} pages Available analytics pages.
 * @return {!import('../ui/render-plan.js').RenderPlan} Analytics overview with key metrics and section navigation.
 */
export function overview(analytics, pages) {
  const s = analytics.scope, p = analytics.provenance;
  const best = analytics.finance.prices.map(row => `${money(row.total, row.currency)}`).join(' · ') ||
    t("analytics.finance.noPrices");
  return renderTemplate('overview', {
    metricGrid: metricGrid([
      metric(t("analytics.inventory.bottlings"), number(s.bottlings)),
      metric(t("forms.bottle.plural"), number(s.bottles)),
      metric(t("backups.summary.distilleriesLabel"), number(s.distilleries)),
      metric(t("analytics.inventory.nominalVolume"), `${number(s.volumeLitres)} l`),
      metric(
        t("analytics.inventory.openedStatus"),
        number(analytics.inventory.status.find(v => v.name === 'Geöffnet')?.count || 0)
      ),
      metric(
        t("analytics.inventory.samples"),
        number(analytics.inventory.volumeTypes.find(v => v.name === 'Samples')?.count || 0)
      ),
    ]),
    two: two(
      panel(
        t("analytics.rankings.topDistilleries"),
        rankBars(p.byDistilleryBottles.slice(0, 8), {value: 'bottles', drill: true})
      ),
      panel(
        t("forms.bottle.status"),
        composition(
          analytics.inventory.status,
          {
            drill: {
              kind: 'status',
              Geschlossen: 'closed',
              Geöffnet: 'open',
              Leer: 'empty',
            },
          }
        )
      )
    ),
    best: safe(best),
    priceCoverage: t("analytics.statistics.priceCoverage", {priced: analytics.finance.priceCoverage, total: s.bottles}),
    sectionHeading: sectionHeading(t("analytics.sections.all")),
    sectionCards: composeMarkup(pages.slice(1).map(page => sectionCard(page))),
  });
}
