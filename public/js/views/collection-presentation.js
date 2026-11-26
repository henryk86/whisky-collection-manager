import {composeMarkup} from '../ui/render-plan.js';
import {t, currentLanguage} from '../i18n/index.js';
import {chevronLeftIcon, chevronRightIcon, chevronsLeftIcon, chevronsRightIcon} from '../ui/action-icons.js';
import {inventoryCountGroups} from '../domain/inventory-counts.js';
import {hasBottlingDetail} from '../domain/bottling-details.js';
import {visiblePages, PAGE_SIZE_OPTIONS} from '../domain/pagination.js';
import {glencairnRatingSymbol} from '../ui/glencairn-icon.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates('collection/home.html');

export {statusText} from './models/home.js';
import {statusText, createCollectionRatingModel} from './models/home.js';

/**
 * The count labels represent mutually exclusive bottle types. Sample bottles
 * are not displayed again in the Standardflaschen count.
 *
 * @param {*} physicalBottles Physical bottles used by this operation.
 * @return {import('../ui/render-plan.js').RenderPlan|string} Inventory status and quantity badges for the represented bottles (or scalar/empty text when no plan is needed).
 */
export function inventoryBadges(physicalBottles) {
  return composeMarkup(inventoryCountGroups(physicalBottles).map(group => renderTemplate('badge', {
    type: group.type === 'sample' ? ' sample' : '',
    status: group.status === 'open' ? ' open' : '',
    t: t(
      ({
        "standard.closed": "home.badges.standardClosed",
        "standard.open": "home.badges.standardOpen",
        "sample.closed": "home.badges.sampleClosed",
        "sample.open": "home.badges.sampleOpen",
      })[`${group.type}.${group.status}`],
      {count: group.count}
    ),
  })));
}

/**
 * Only supplied details are shown on cards and in the overview table.
 *
 * @param {*} value Input value to process.
 * @param {string=} suffix Suffix used by this operation.
 * @return {string} Known metadata with its supplied suffix, or empty text when missing.
 */
export function overviewField(value, suffix = '') {
  return hasBottlingDetail(value) ? `${String(value ?? '')}${suffix}` : '';
}

/**
 * Filters records according to the overview facts selection rules.
 *
 * @param {*} bottling Bottling record being inspected or updated.
 * @return {!Array<*>} Resulting entries in their output order.
 */
export function overviewFacts(bottling) {
  return [
    hasBottlingDetail(bottling.ageYears) ? t('home.facts.years', {count: bottling.ageYears}) : '',
    overviewField(bottling.abv, ' % Vol.'),
  ].filter(Boolean);
}

/**
 * Render a single table cell. The same field definitions power both table
 * modes.
 *
 * @param {*} columnId Column id used by this operation.
 * @param {!Object} model Prepared inventory row.
 * @return {!Object} Table cell render plan.
 */
export function collectionTableCell(columnId, model) {
  const {bottling, bottle, displayedBottles, origin, score, price, updated, tasted} = model;
  let value = '';
  switch (columnId) {
    case 'name': value = renderTemplate('strong', {name: bottling.name, }); break;
    case 'inventory': value = bottle?.inventoryNumber ? `#${String(bottle.inventoryNumber ?? '')}` : t('imports.bottles.noInventoryNumber'); break;
    case 'distillery': value = String(origin ?? ''); break;
    case 'age': value = overviewField(bottling.ageYears); break;
    case 'abv': value = overviewField(bottling.abv, ' %'); break;
    case 'year': value = overviewField(bottling.releaseYear); break;
    case 'stock': value = renderTemplate('inventoryBadges', {inventoryBadges: inventoryBadges(displayedBottles), }); break;
    case 'editing': value = bottling.completionStatus === 'complete' ? t('detail.status.complete') : t('detail.status.incomplete'); break;
    case 'rating': {
      value = score == null ? '–' :
        t(
          'home.table.scoreValue',
          {
            score: new Intl.NumberFormat(currentLanguage() === 'de' ? 'de-DE' : 'en-US', {maximumFractionDigits: 2}).format(Number(score)),
          }
        );
      break;
    }
    case 'status': value = bottle ?
      renderTemplate('badge2', {
        status: bottle.status || '',
        statusText: statusText(bottle.status),
      }) : ''; break;
    case 'type': value = bottle ? t(bottle.volumeType === 'sample' ? 'imports.bottles.sample' : 'imports.bottles.standard') : ''; break;
    case 'size': value = bottle?.volumeMl != null ? `${String(bottle.volumeMl ?? '')} ml` : ''; break;
    case 'price': {
      value = price ? new Intl.NumberFormat(
        currentLanguage() === 'de' ? 'de-DE' : 'en-US',
        {style: 'currency', currency: price.currency}
      ).format(price.value) : '–';
      break;
    }
    case 'updated':
    case 'tasted': {
      const date = columnId === 'updated' ? updated : tasted;
      value = date && Number.isFinite(new Date(date).getTime()) ?
        String((new Date(date).toLocaleDateString(currentLanguage())) ?? '') : '–';
      break;
    }
  }
  return renderTemplate('td', {value: value, });
}

/**
 * Compact, non-interactive rating shown inside the photo frame.
 *
 * @param {!Object} bottling Bottling record being processed.
 * @param {null=} photoId Identifier of the photo.
 * @return {import('../ui/render-plan.js').RenderPlan|string} Glencairn rating summary for a rated bottling (or scalar/empty text when no plan is needed).
 */
export function collectionCardRating(bottling, photoId = null) {
  const model = createCollectionRatingModel(bottling);
  if (!model) return '';
  const {score: safe, fills} = model;
  const unique = String(photoId || bottling.id || 'bottling').replace(/[^a-zA-Z0-9_-]/g, '-');
  const glasses = composeMarkup(fills.map((fill, i) => glencairnRatingSymbol({fill, id: `overview-rating-${unique}-${i}`})));
  return renderTemplate('collectionCardRating', {
    ratingScore: t('home.filters.ratingScore', {score: String(safe).replace('.', ','), }),
    title: t('home.filters.ratingScore', {score: String(safe).replace('.', ','), }),
    glasses: glasses,
  });
}

/**
 * Render only the necessary page controls; page content is loaded from local
 * JSON.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @param {*} selectedSize Selected size used by this operation.
 * @param {string=} mode Requested display mode or configuration variant.
 * @return {!import('../ui/render-plan.js').RenderPlan} Collection pagination, result range and page-size controls.
 */
export function pagerHtml({page, pageCount, total, from, to}, selectedSize,
  mode = 'bottlings') {
  const label = mode === 'bottles' ? t("forms.bottle.plural") : t("analytics.inventory.bottlings");
  const pageSizeLabel = mode === 'bottles' ? t("home.pagination.bottlesPerPage") : t("home.pagination.bottlingsPerPage");
  /**
   * Prepares pagination button with target page and disabled state.
   *
   * @param {*} target Target of the operation.
   * @param {*} label Label shown to the user.
   * @param {*} title Title displayed or stored by this operation.
   * @param {boolean=} disabled Value used by this operation.
   * @return {!import('../ui/render-plan.js').RenderPlan} Pagination button with target page and disabled state.
   */
  const button = (target, label, title, disabled = false) =>
    renderTemplate('smallButton', {
      target: target,
      title: title,
      disabledAttributes: disabled ? {"disabled": true} : {},
      label: label,
    });
  const pages = composeMarkup(visiblePages(page, pageCount).map(number =>
    number === '…'
      ? renderTemplate('paginationEllipsis')
      : renderTemplate('smallButton2', {
        number: number === page ? ' current' : '',
        pageTo: number,
        pageLabel: t("home.pagination.pageLabel", {page: number}),
        ariaCurrentAttributes: number === page ? {"aria-current": "page"} : {},
        pageNumberLabel: number,
      })));
  return renderTemplate('collectionPagination', {
    rangeSummary: t("home.pagination.rangeSummary", {from, to, total, label}),
    button: button(1, chevronsLeftIcon, t('home.pagination.first'), page === 1),
    previousPageButton: button(Math.max(1, page - 1), chevronLeftIcon, t('home.pagination.previous'), page === 1),
    pages: pages,
    nextPageButton: button(Math.min(pageCount, page + 1), chevronRightIcon, t('home.pagination.next'), page === pageCount),
    lastPageButton: button(pageCount, chevronsRightIcon, t('home.pagination.last'), page === pageCount),
    pageSizeLabel: pageSizeLabel,
    ariaLabel: pageSizeLabel,
    pageSizeChoices: composeMarkup(PAGE_SIZE_OPTIONS.map(option =>
      renderTemplate(
        'pagerHtmlOption',
        {
          option: option,
          selectedAttributes: option === selectedSize ? {"selected": true} : {},
          pageSizeLabel: option,
        }
      ))),
  });
}
