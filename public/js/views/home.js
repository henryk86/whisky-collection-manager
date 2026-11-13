import { displayPhotoPath } from '../domain/photo-images.js';
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

/** Collection overview owns its own filter bindings, never data writes. */
export function createHomeView({ state, selectors, shell }) {
    const { allBottles, bottles, coverPhoto, distilleryNames } = selectors;
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
            sort: state.sort, distillery: state.distillery, volumeType: state.volumeType, distilleryNames,
        });
        const pageSize = state.pageSize;
        const pageData = paginate(list, state.pageNumber, pageSize);
        if (state.pageNumber !== pageData.page) {
            state.pageNumber = pageData.page;
            history.replaceState({ whiskyRoute: true }, '', homePageUrl(pageData.page, mode));
        }
        const visibleList = pageData.items;
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
    <div class="card-img">${photo ? `<img src="${imageUrl(photo)}" alt="${escapeHtml(t("home.image.bottleAlt",{name:bottling.name}))}" loading="lazy">` : '<img class="image-placeholder" src="/assets/photo-placeholder.svg" alt="" aria-hidden="true">'}</div>
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
    <p>${t("home.hero.description")}</p>
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
    <div class="toolbar">
    <input type="search" id="search" aria-label="${t("home.filters.searchCollection")}" placeholder="${t("home.filters.searchPlaceholder")}" value="${escapeHtml(state.search)}">
    <select id="filter-status" aria-label="${t("forms.bottle.status")}">
    <option value="all">${t("home.filters.allStatuses")}</option>${Object.entries(bottleStatusLabels).map(([k, v]) => `<option value="${k}" ${state.status === k ? 'selected' : ''}>${statusText(k)}</option>`).join('')}</select>
    <select id="filter-completion" aria-label="${t("home.filters.completeness")}">
    <option value="all">${t("home.filters.allEntries")}</option>
    <option value="incomplete" ${state.completion === 'incomplete' ? 'selected' : ''}>${t("detail.status.incomplete")}</option>
    <option value="complete" ${state.completion === 'complete' ? 'selected' : ''}>${t("detail.status.complete")}</option>
    </select>
    <select id="filter-sort" aria-label="${t("home.sort.title")}">
    <option value="name">${t("home.sort.nameAscending")}</option>
    <option value="newest" ${state.sort === 'newest' ? 'selected' : ''}>${t("home.sort.newestFirst")}</option>
    <option value="age" ${state.sort === 'age' ? 'selected' : ''}>${t("home.sort.ageDescending")}</option>
    <option value="year" ${state.sort === 'year' ? 'selected' : ''}>${t("forms.bottling.releaseYear")}</option>
    </select>
    <select id="filter-distillery" aria-label="${t("home.filters.filterDistillery")}">
    <option value="all">${t("home.filters.allDistilleries")}</option>
    ${distilleries.map(item => `<option value="${escapeHtml(item.id)}" ${state.distillery === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
    </select>
    <select id="filter-volume-type" aria-label="${t("home.filters.filterBottleType")}">
    <option value="all" ${state.volumeType === 'all' ? 'selected' : ''}>${t("home.filters.allBottleTypes")}</option>
    <option value="standard" ${state.volumeType === 'standard' ? 'selected' : ''}>${t("home.inventory.standardBottles")}</option>
    <option value="sample" ${state.volumeType === 'sample' ? 'selected' : ''}>${t("analytics.inventory.samples")}</option>
    </select>
    <button class="btn small" type="button" data-act="toggle-view">${state.view === 'cards' ? `☷ ${t('home.view.table')}` : `▦ ${t('home.view.cards')}`}</button>
    </div>${pageData.pageCount > 1 ? `<div class="pagination-topline">
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
        // Keep the home URL in sync without polluting browser history for filter changes.
        function updatePageUrl(replace = false) {
            const url = homePageUrl(state.pageNumber, state.overviewMode);
            if (location.pathname + location.search !== url) {
                history[replace ? 'replaceState' : 'pushState']({ whiskyRoute: true }, '', url);
            }
        }
        function changePage(target) {
            const next = paginate(list, target, pageSize).page;
            if (next === state.pageNumber) return;
            state.pageNumber = next;
            updatePageUrl();
            home();
            document.querySelector('.collection-heading')?.scrollIntoView({ block: 'start', behavior: 'auto' });
        }
        document.querySelectorAll('[data-collection-mode]').forEach(button => button.addEventListener('click', () => {
            const nextMode = button.dataset.collectionMode;
            if (nextMode === state.overviewMode) return;
            state.overviewMode = nextMode;
            state.pageNumber = 1;
            updatePageUrl();
            home();
        }));
        document.querySelectorAll('[data-page-to]').forEach(button => button.addEventListener('click', () => {
            changePage(Number(button.dataset.pageTo));
        }));
        query('#pagination-size')?.addEventListener('change', event => {
            state.pageSize = Number(event.target.value);
            savePageSizePreference(state.pageSize);
            state.pageNumber = 1;
            updatePageUrl(true);
            home();
            document.querySelector('.collection-heading')?.scrollIntoView({ block: 'start', behavior: 'auto' });
        });
        query('#search').addEventListener('input', ev => {
            state.search = ev.target.value;
            state.pageNumber = 1;
            updatePageUrl(true);
            const cursor = ev.target.selectionStart;
            home();
            query('#search').focus();
            query('#search').setSelectionRange(cursor, cursor);
        });
        for (const [sel, key] of [['#filter-status', 'status'], ['#filter-completion', 'completion'], ['#filter-sort', 'sort'],
            ['#filter-distillery', 'distillery'], ['#filter-volume-type', 'volumeType']]) {
            query(sel).addEventListener('change', ev => {
                state[key] = ev.target.value;
                state.pageNumber = 1;
                updatePageUrl(true);
                home();
            });
        }
    }
    return home;
}
