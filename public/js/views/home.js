import { displayPhotoPath } from '../../../shared/photo-images.js';
import { t } from '../i18n/index.js';
const statusText = status => t(({closed:'home.status.closed',open:'analytics.inventory.openedStatus',empty:'home.status.empty'})[status] || 'features.distilleries.unknownStatus');
import { newBottlingIcon, inventoryScanIcon } from '../ui/action-icons.js';
import { escapeHtml, query } from '../ui/dom.js';
import { imageUrl } from '../ui/format.js';
import { bottleStatusLabels } from '../domain/labels.js';
import { inventoryCountGroups } from '../domain/inventory-counts.js';
import { bottlingOriginLabel } from '../domain/bottling-origin.js';
import { hasBottlingDetail } from '../domain/bottling-details.js';
import { paginate, visiblePages, PAGE_SIZE_OPTIONS, homePageUrl } from '../domain/pagination.js';
import { savePageSizePreference } from '../domain/page-size-preference.js';
import { availableOverviewDistilleries, collectionOverviewEntries } from '../domain/collection-overview.js';
import { displayedTastingRating } from '../../../shared/tasting-records.js';
import { glencairnRatingSymbol } from '../ui/glencairn-icon.js';
/**
 * The count labels represent mutually exclusive bottle types. Sample bottles
 * are not displayed again in the Standardflaschen count.
 */
function inventoryBadges(physicalBottles) {
    return inventoryCountGroups(physicalBottles)
        .map(group => `<span class="badge${group.type === 'sample' ? ' sample' : ''}${group.status === 'open' ? ' open' : ''}">${t(({"standard.closed":"home.badges.standardClosed","standard.open":"home.badges.standardOpen","sample.closed":"home.badges.sampleClosed","sample.open":"home.badges.sampleOpen"})[`${group.type}.${group.status}`],{count:group.count})}</span>`)
        .join('');
}

/** Only supplied details are shown on cards and in the overview table. */
function overviewField(value, suffix = '') {
    return hasBottlingDetail(value) ? `${escapeHtml(value)}${suffix}` : '';
}

function overviewFacts(bottling) {
    return [
        hasBottlingDetail(bottling.ageYears) ? t('home.facts.years',{count:bottling.ageYears}) : '',
        overviewField(bottling.abv, ' % Vol.'),
    ].filter(Boolean);
}

/** Compact, non-interactive rating shown inside the photo frame. */
export function collectionCardRating(bottling, photoId = null) {
    const score = displayedTastingRating(bottling);
    if (score == null || !Number.isFinite(Number(score))) return '';
    const safe = Math.min(100, Math.max(0, Number(score)));
    const unique = String(photoId || bottling.id || 'bottling').replace(/[^a-zA-Z0-9_-]/g,'-');
    const glasses = Array.from({length:5},(_,i) => {
        const fill = Math.max(0, Math.min(100, (safe-i*20)*5));
        return glencairnRatingSymbol({fill,id:`overview-rating-${unique}-${i}`});
    }).join('');
    return `<span class="collection-card-rating" role="img" aria-label="${escapeHtml(t('home.filters.ratingScore',{score:String(safe).replace('.',',')}))}" title="${escapeHtml(t('home.filters.ratingScore',{score:String(safe).replace('.',',')}))}">${glasses}</span>`;
}

/** Render only the necessary page controls; page content is loaded from local JSON. */
function pagerHtml({ page, pageCount, total, from, to }, selectedSize, mode = 'bottlings') {
    const label = mode === 'bottles' ? t("forms.bottle.plural") : t("analytics.inventory.bottlings");
    const pageSizeLabel = mode === 'bottles' ? t("home.pagination.bottlesPerPage") : t("home.pagination.bottlingsPerPage");
    const button = (target, label, title, disabled = false) => `<button type="button" class="btn small pagination-button" data-page-to="${target}" aria-label="${title}" ${disabled ? 'disabled' : ''}>${label}</button>`;
    const pages = visiblePages(page, pageCount).map(number => number === '…'
        ? '<span class="pagination-ellipsis" aria-hidden="true">…</span>'
        : `<button type="button" class="btn small pagination-button${number === page ? ' current' : ''}" data-page-to="${number}" aria-label="${t("home.pagination.pageLabel", {page:number})}" ${number === page ? 'aria-current="page"' : ''}>${number}</button>`).join('');
    return `<nav class="collection-pagination" aria-label="${t("home.pagination.collectionPages")}">
        <span class="pagination-summary">${t("home.pagination.rangeSummary", {from,to,total,label})}</span>
        <div class="pagination-pages">
            ${button(1, '«', t('home.pagination.first'), page === 1)}
            ${button(Math.max(1, page - 1), '‹', t('home.pagination.previous'), page === 1)}
            ${pages}
            ${button(Math.min(pageCount, page + 1), '›', t('home.pagination.next'), page === pageCount)}
            ${button(pageCount, '»', t('home.pagination.last'), page === pageCount)}
        </div>
        <label class="pagination-size">${pageSizeLabel}
            <select id="pagination-size" aria-label="${pageSizeLabel}">${PAGE_SIZE_OPTIONS.map(option => `<option value="${option}" ${option === selectedSize ? 'selected' : ''}>${option}</option>`).join('')}</select>
        </label>
    </nav>`;
}

/** Collection overview uses delegated root events; render does not bind listeners. */
export function createHomeView({ state, selectors, shell }) {
    const { allBottles, bottles, coverPhoto, distilleryNames } = selectors;
    let activeList = [];
    let activePageSize = 1;
    let filtersExpanded = false;
    function updatePageUrl(replace = false) {
        const url = homePageUrl(state.pageNumber, state.overviewMode);
        if (location.pathname + location.search !== url) {
            history[replace ? 'replaceState' : 'pushState']({ whiskyRoute: true }, '', url);
        }
    }
    function changePage(target) {
        const next = paginate(activeList, target, activePageSize).page;
        if (next === state.pageNumber) return;
        state.pageNumber = next;
        updatePageUrl();
        home();
        document.querySelector('.collection-heading')?.scrollIntoView({block:'start',behavior:'auto'});
    }
    function handleClick(button) {
        if (state.page !== 'home') return;
        if (button.dataset.act === 'toggle-collection-filters') {
            filtersExpanded = !filtersExpanded;
            const toolbar = document.querySelector('.collection-filters');
            if (toolbar) toolbar.dataset.expanded = String(filtersExpanded);
            button.setAttribute('aria-expanded', String(filtersExpanded));
            return;
        }
        if (button.dataset.resetCollectionFilter) {
            const key = button.dataset.resetCollectionFilter;
            if (!['status','completion','distillery','rating','volumeType'].includes(key)) return;
            state[key] = 'all';
            state.pageNumber = 1;
            updatePageUrl(true);
            home();
            return;
        }
        if (button.dataset.collectionMode) {
            if (state.overviewMode === button.dataset.collectionMode) return;
            state.overviewMode = button.dataset.collectionMode;
            state.pageNumber = 1;
            updatePageUrl();
            home();
        } else if (button.dataset.pageTo) changePage(Number(button.dataset.pageTo));
    }
    function handleChange(input) {
        if (state.page !== 'home') return;
        if (input.id === 'pagination-size') {
            state.pageSize = Number(input.value);
            savePageSizePreference(state.pageSize);
        } else {
            const field = {
                'filter-status':'status','filter-completion':'completion','filter-sort':'sort',
                'filter-distillery':'distillery','filter-volume-type':'volumeType', 'filter-rating':'rating'
            }[input.id];
            if (!field) return;
            state[field] = input.value;
        }
        state.pageNumber = 1;
        updatePageUrl(true);
        home();
        if (input.id === 'pagination-size') document.querySelector('.collection-heading')?.scrollIntoView({block:'start',behavior:'auto'});
    }
    function handleInput(input) {
        if (state.page !== 'home' || input.id !== 'search') return;
        state.search = input.value;
        state.pageNumber = 1;
        updatePageUrl(true);
        const cursor = input.selectionStart;
        home();
        const node = document.getElementById('search');
        if (node) { node.focus(); node.setSelectionRange(cursor, cursor); }
    }
    function home() {
        const collection = state.collection;
        const physical = allBottles();
        const total = physical.length, open = physical.filter(entry => entry.status === 'open').length, closed = physical.filter(entry => entry.status === 'closed').length;
        const establishedYear = collection.settings?.establishedYear;
        const mode = state.overviewMode === 'bottles' ? 'bottles' : 'bottlings';
        const label = mode === 'bottles' ? t("forms.bottle.plural") : t("analytics.inventory.bottlings");
        const distilleries = availableOverviewDistilleries(collection);
        // Do not keep a deleted distillery selected after refreshing the collection.
        if (state.distillery !== 'all' && !distilleries.some(item => item.id === state.distillery)) {
            state.distillery = 'all';
        }
        // The mode changes the unit of filtering, counting and pagination, not the collection data.
        const list = collectionOverviewEntries(collection, {
            mode, search: state.search, status: state.status, completion: state.completion,
            sort: state.sort, distillery: state.distillery, volumeType: state.volumeType, rating: state.rating, distilleryNames,
        });
        const pageSize = state.pageSize;
        const pageData = paginate(list, state.pageNumber, pageSize);
        if (state.pageNumber !== pageData.page) {
            state.pageNumber = pageData.page;
            history.replaceState({ whiskyRoute: true }, '', homePageUrl(pageData.page, mode));
        }
        const visibleList = pageData.items;
        activeList = list;
        activePageSize = pageSize;
        const cards = visibleList.map(({ bottling, bottle }) => {
            const physicalBottles = bottle ? [bottle] : bottles(bottling.id);
            const origin = bottlingOriginLabel(bottling, distilleryNames);
            const facts = overviewFacts(bottling);
            // Prefer the photo of this physical bottle; without one, show the same
            // cover photo as the bottling overview (without modifying photo data).
            const photo = displayPhotoPath((bottle?.photos || [])[0]) || coverPhoto(bottling.id);
            const bottleInfo = bottle ? [
                bottle.inventoryNumber ? `#${escapeHtml(bottle.inventoryNumber)}` : t("imports.bottles.noInventoryNumber"),
                bottle.volumeMl != null ? `${escapeHtml(bottle.volumeMl)} ml` : '',
            ].filter(Boolean).join(' · ') : '';
            return `<article tabindex="0" class="whisky-card" data-act="open" data-id="${escapeHtml(bottling.id)}"${bottle ? ` data-bottle-id="${escapeHtml(bottle.id)}" aria-label="${escapeHtml(t("home.image.bottleAccessibleName",{name:bottling.name,number:bottle.inventoryNumber || t("home.inventory.withoutInventoryNumber")}))}"` : ''}>
    <div class="card-img">${photo ? `<img src="${imageUrl(photo)}" alt="${escapeHtml(t("home.image.bottleAlt",{name:bottling.name}))}" loading="lazy">` : '<img class="image-placeholder" src="/assets/photo-placeholder.svg" alt="" aria-hidden="true">'}${collectionCardRating(bottling, bottle?.id)}</div>
    <div class="card-body">
    ${origin ? `<div class="card-kicker">${escapeHtml(origin)}</div>` : ''}
    <h3 data-i18n-ignore>${escapeHtml(bottling.name)}</h3>
    ${bottleInfo ? `<div class="card-bottle-meta">${bottleInfo}</div>` : ''}
    ${facts.length ? `<div class="card-facts muted">${facts.join(' · ')}</div>` : ''}
    <div class="badges">
    ${bottle ? `<span class="badge ${escapeHtml(bottle.status || '')}">${escapeHtml(statusText(bottle.status))}</span>${bottle.volumeType === 'sample' ? '<span class="badge sample">Sample</span>' : ''}` : inventoryBadges(physicalBottles)}${bottling.completionStatus === 'incomplete' ? `<span class="badge">${t("home.status.incomplete")}</span>` : ''}</div>
    </div>
    </article>`;
        }).join('');
        const rows = visibleList.map(({ bottling, bottle }) => {
            const physicalBottles = bottle ? [bottle] : bottles(bottling.id);
            if (bottle) return `<tr class="clickable" tabindex="0" data-act="open" data-id="${escapeHtml(bottling.id)}" data-bottle-id="${escapeHtml(bottle.id)}" aria-label="${escapeHtml(t("home.image.bottleAccessibleName",{name:bottling.name,number:bottle.inventoryNumber || t("home.inventory.withoutInventoryNumber")}))}">
    <td><strong>${escapeHtml(bottling.name)}</strong></td>
    <td>${bottle.inventoryNumber ? `#${escapeHtml(bottle.inventoryNumber)}` : t("imports.bottles.noInventoryNumber")}</td>
    <td>${escapeHtml(bottlingOriginLabel(bottling, distilleryNames))}</td>
    <td>${overviewField(bottling.ageYears)}</td>
    <td>${overviewField(bottling.abv, ' %')}</td>
    <td><span class="badge ${escapeHtml(bottle.status || '')}">${escapeHtml(statusText(bottle.status))}</span></td>
    <td>${bottle.volumeType === 'sample' ? t("imports.bottles.sample") : t("imports.bottles.standard")}</td>
    <td>${bottle.volumeMl != null ? `${escapeHtml(bottle.volumeMl)} ml` : ''}</td>
    </tr>`;
            return `<tr class="clickable" tabindex="0" data-act="open" data-id="${escapeHtml(bottling.id)}">
    <td>
    <strong>${escapeHtml(bottling.name)}</strong>
    </td>
    <td>${escapeHtml(bottlingOriginLabel(bottling, distilleryNames))}</td>
    <td>${overviewField(bottling.ageYears)}</td>
    <td>${overviewField(bottling.abv, ' %')}</td>
    <td>${overviewField(bottling.releaseYear)}</td>
    <td><div class="inventory-badges">${inventoryBadges(physicalBottles)}</div></td>
    <td>${bottling.completionStatus === 'complete' ? t("detail.status.complete") : t("detail.status.incomplete")}</td>
    </tr>`;
        }).join('');
        // The original description stays verbatim. CSS keeps the whole copy on
        // one line on desktop and permits natural wrapping on small screens.
        const heroCopy = escapeHtml(t('home.hero.description'));
        shell(`<section class="collection-hero">
    <div class="hero-media" aria-hidden="true">
    <img src="/assets/hero-header.jpg" alt="">
    </div>
    <div class="hero-overlay" aria-hidden="true">
    </div>
    <div class="hero-content">
    <span class="eyebrow">
    <span class="eyebrow-line">
    </span> ${t("home.hero.personalArchiveEyebrow")}</span>
    <h2>${t("home.hero.oneCollection")}<br>
    <em>${t("home.hero.manyStories")}</em>
    </h2>
    <p class="hero-description">${heroCopy}</p>
    <div class="hero-actions">
    <button class="btn primary" type="button" data-act="new" aria-label="${t("collection.actions.newBottle")}">${newBottlingIcon}<span>${t("collection.actions.newBottle")}</span></button>
    <button class="btn hero-secondary" type="button" data-act="scan" aria-label="${t("collection.actions.scanInventory")}">${inventoryScanIcon}<span>${t("collection.actions.scanInventory")}</span></button>
    </div>
    </div>
    <span class="hero-footnote">COLLECTION${establishedYear ? ` · EST. ${establishedYear}` : ''}</span>
    </section>
    <div class="section-head collection-heading">
    <div>
    <span class="eyebrow dark">${t("home.hero.archiveEyebrow")}</span>
    <h2>${t("home.collection.title")}<span class="heading-period">.</span>
    </h2>
    <p class="intro">${t("home.hero.everyBottlingHasStory")}</p>
    </div>
    <div class="collection-mode-toggle" role="group" aria-label="${t("home.view.displayAs")}">
    <button type="button" class="collection-mode-button${mode === 'bottlings' ? ' active' : ''}" data-collection-mode="bottlings" aria-pressed="${mode === 'bottlings'}">${t("analytics.inventory.bottlings")} <span class="collection-mode-count">${collection.bottlings.length}</span></button>
    <button type="button" class="collection-mode-button${mode === 'bottles' ? ' active' : ''}" data-collection-mode="bottles" aria-pressed="${mode === 'bottles'}">${t("forms.bottle.plural")} <span class="collection-mode-count">${total}</span></button>
    </div>
    </div>
    <div class="stats">
    <div class="panel stat">
    <span>${t("analytics.inventory.bottlings")}</span>
    <strong>${collection.bottlings.length}</strong>
    </div>
    <div class="panel stat">
    <span>${t("home.inventory.totalStock")}</span>
    <strong>${total}</strong>
    </div>
    <div class="panel stat">
    <span>${t("home.status.closed")}</span>
    <strong>${closed}</strong>
    </div>
    <div class="panel stat">
    <span>${t("analytics.inventory.openedStatus")}</span>
    <strong>${open}</strong>
    </div>
    </div>
    ${(() => {
        const distillery = distilleries.find(item => item.id === state.distillery);
        const rating = state.rating === 'unrated' ? t('home.filters.unrated') :
            ['1','2','3','4','5'].includes(state.rating) ? t('home.filters.ratingRange', {
                from:state.rating === '1' ? '0' : `${(Number(state.rating)-1)*20},1`,
                to:Number(state.rating)*20
            }) : null;
        const active = [
            ['status',state.status !== 'all' ? statusText(state.status) : null,t('forms.bottle.status')],
            ['completion',state.completion === 'complete' ? t('detail.status.complete') : state.completion === 'incomplete' ? t('detail.status.incomplete') : null,t('home.filters.completeness')],
            ['distillery',distillery?.name,t('home.filters.filterDistillery')],
            ['rating',rating,t('home.filters.filterRating')],
            ['volumeType',state.volumeType === 'sample' ? t('analytics.inventory.samples') : state.volumeType === 'standard' ? t('home.inventory.standardBottles') : null,t('home.filters.filterBottleType')],
        ].filter(([,value]) => value);
        return `<div class="toolbar collection-filters" data-expanded="${filtersExpanded}" aria-label="${escapeHtml(t('home.filters.filters'))}">
    <input type="search" id="search" aria-label="${t('home.filters.searchCollection')}" placeholder="${t('home.filters.searchPlaceholder')}" value="${escapeHtml(state.search)}">
    <select id="filter-sort" aria-label="${t('home.sort.title')}">
    ${[
        ['name','home.sort.nameAscending'],
        ['nameDesc','home.sort.nameDescending'],
        ['distillery','home.sort.distilleryAscending'],
        ['distilleryDesc','home.sort.distilleryDescending'],
        ['priceAsc',mode === 'bottles' ? 'home.sort.priceAscending' : 'home.sort.averagePriceAscending'],
        ['priceDesc',mode === 'bottles' ? 'home.sort.priceDescending' : 'home.sort.averagePriceDescending'],
        ['scoreDesc','home.sort.scoreDescending'],
        ['scoreAsc','home.sort.scoreAscending'],
        ['updatedDesc','home.sort.updatedDescending'],
        ['updatedAsc','home.sort.updatedAscending'],
        ['tastedDesc','home.sort.tastedDescending'],
        ['tastedAsc','home.sort.tastedAscending'],
        ['newest','home.sort.newestFirst'],
        ['age','home.sort.ageDescending'],
        ['year','forms.bottling.releaseYear'],
    ].map(([value,key]) => `<option value="${value}" ${state.sort === value ? 'selected' : ''}>${t(key)}</option>`).join('')}
    </select>
    <select id="filter-status" aria-label="${t('forms.bottle.status')}">
    <option value="all">${t('home.filters.allStatuses')}</option>${Object.entries(bottleStatusLabels).map(([k]) => `<option value="${k}" ${state.status === k ? 'selected' : ''}>${statusText(k)}</option>`).join('')}</select>
    <select id="filter-completion" aria-label="${t('home.filters.completeness')}">
    <option value="all">${t('home.filters.allEntries')}</option>
    <option value="incomplete" ${state.completion === 'incomplete' ? 'selected' : ''}>${t('detail.status.incomplete')}</option>
    <option value="complete" ${state.completion === 'complete' ? 'selected' : ''}>${t('detail.status.complete')}</option>
    </select>
    <button type="button" class="btn collection-filter-toggle" data-act="toggle-collection-filters" aria-expanded="${filtersExpanded}" aria-controls="collection-filter-extra"><svg class="collection-filter-icon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/></svg><span class="collection-filter-toggle-desktop">${t('home.filters.moreFilters')}</span><span class="collection-filter-toggle-mobile">${t('home.filters.filters')}</span><svg class="collection-filter-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
    <button class="btn collection-filter-view" type="button" data-act="toggle-view" aria-label="${state.view === 'cards' ? t('home.view.table') : t('home.view.cards')}" title="${state.view === 'cards' ? t('home.view.table') : t('home.view.cards')}"><span aria-hidden="true">${state.view === 'cards' ? '☷' : '▦'}</span> <span class="collection-filter-view-text">${state.view === 'cards' ? t('home.view.table') : t('home.view.cards')}</span></button>
    <div class="collection-filter-extra" id="collection-filter-extra" role="group" aria-label="${t('home.filters.moreFilters')}">
        <select id="filter-distillery" aria-label="${t('home.filters.filterDistillery')}">
        <option value="all">${t('home.filters.allDistilleries')}</option>
        ${distilleries.map(item => `<option value="${escapeHtml(item.id)}" ${state.distillery === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
        </select>
        <select id="filter-rating" aria-label="${t('home.filters.filterRating')}">
        <option value="all" ${state.rating === 'all' ? 'selected' : ''}>${t('home.filters.allRatings')}</option>
        ${[1,2,3,4,5].map(level=>`<option value="${level}" ${state.rating === String(level) ? 'selected' : ''}>${t('home.filters.ratingRange',{from:level===1?'0':`${(level-1)*20},1`,to:level*20})}</option>`).join('')}
        <option value="unrated" ${state.rating === 'unrated' ? 'selected' : ''}>${t('home.filters.unrated')}</option>
        </select>
        <select id="filter-volume-type" aria-label="${t('home.filters.filterBottleType')}">
        <option value="all" ${state.volumeType === 'all' ? 'selected' : ''}>${t('home.filters.allBottleTypes')}</option>
        <option value="standard" ${state.volumeType === 'standard' ? 'selected' : ''}>${t('home.inventory.standardBottles')}</option>
        <option value="sample" ${state.volumeType === 'sample' ? 'selected' : ''}>${t('analytics.inventory.samples')}</option>
        </select>
    </div>
    ${active.length ? `<div class="collection-filter-active" aria-label="${t('home.filters.activeFilters')}">${active.map(([key,value,label]) => `<button type="button" class="collection-filter-chip" data-reset-collection-filter="${key}" aria-label="${escapeHtml(t('home.filters.removeFilter',{name:`${label}: ${value}`}))}">${escapeHtml(label)}: ${escapeHtml(value)} <span aria-hidden="true">×</span></button>`).join('')}</div>` : ''}
    </div>`;
    })()}${pageData.pageCount > 1 ? `<div class="pagination-topline">
        <span>${t("home.pagination.rangeSummary",{from:pageData.from,to:pageData.to,total:pageData.total,label})}</span>
        <div class="pagination-topactions">
            <button type="button" class="btn small" data-page-to="${Math.max(1, pageData.page - 1)}" ${pageData.page === 1 ? 'disabled' : ''} aria-label="${t("home.pagination.previousPageLabel")}">‹</button>
            <span>${t("home.pagination.pageOf", {page:pageData.page,total:pageData.pageCount})}</span>
            <button type="button" class="btn small" data-page-to="${Math.min(pageData.pageCount, pageData.page + 1)}" ${pageData.page === pageData.pageCount ? 'disabled' : ''} aria-label="${t("home.pagination.nextPageLabel")}">›</button>
        </div>
    </div>` : ''}${list.length ? (state.view === 'cards' ? `<div class="grid">${cards}</div>` : `<div class="table-wrap">
    <table>
    <thead>
    <tr>
    ${mode === 'bottles' ? `<th>${t("home.inventory.whisky")}</th>
    <th>${t("forms.bottle.title")}</th>
    <th>${t("home.filters.distilleryOrBottler")}</th>
    <th>${t("analytics.age.title")}</th>
    <th>${t("home.filters.abv")}</th>
    <th>${t("forms.bottle.statusLabel")}</th>
    <th>${t("home.filters.type")}</th>
    <th>${t("home.filters.size")}</th>` : `<th>${t("home.inventory.whisky")}</th>
    <th>${t("home.filters.distilleryOrBottler")}</th>
    <th>${t("analytics.age.title")}</th>
    <th>${t("home.filters.abv")}</th>
    <th>${t("home.filters.year")}</th>
    <th>${t("home.inventory.stock")}</th>
    <th>${t("home.status.editing")}</th>`}
    </tr>
    </thead>
    <tbody>${rows}</tbody>
    </table>
    </div>`) : `<div class="empty-state">
    <strong>${list.length === 0 && mode === 'bottles' && !physical.length && collection.bottlings.length ? t("home.empty.noPhysicalBottles") : collection.bottlings.length ? t("home.empty.noMatchingEntries") : t("home.empty.noBottles")}</strong>
    <p>${mode === 'bottles' && !physical.length && collection.bottlings.length ? t("home.empty.addBottleToExistingHint") : collection.bottlings.length ? t("home.filters.changeFiltersHint") : t("home.empty.getStartedHint")}</p>
    ${collection.bottlings.length ? '' : `<button class="btn primary" data-act="new">${t("collection.actions.newBottle")}</button>`}
    </div>`}${pageData.total ? pagerHtml(pageData, state.pageSize, mode) : ''}`);

    }
    home.handleClick = handleClick;
    home.handleChange = handleChange;
    home.handleInput = handleInput;
    return home;
}
