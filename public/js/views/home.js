import {pageHeader} from '../ui/headers.js';
import {request} from '../api.js';
import {toast} from '../ui/notifications.js';
import {FLAVOR_AXES} from '../../../shared/flavor-profile.js';
import {normalizeFlavorCriteria} from '../../../shared/collection-saved-views.js';
import {displayPhotoPath} from '../../../shared/photo-images.js';
import {t, currentLanguage} from '../i18n/index.js';
const statusText = status => t(({closed: 'home.status.closed', open: 'analytics.inventory.openedStatus', empty: 'home.status.empty'})[status] || 'features.distilleries.unknownStatus');
import {newBottlingIcon, inventoryScanIcon, chevronDownIcon, chevronLeftIcon, chevronRightIcon, chevronsLeftIcon, chevronsRightIcon, arrowUpIcon, arrowDownIcon, arrowsUpDownIcon, closeIcon, collectionTableIcon, collectionCardsIcon, flightPlanIcon} from '../ui/action-icons.js';
import {escapeHtml, query} from '../ui/dom.js';
import {emptyState, panel as contentPanel} from '../ui/content.js';
import {imageUrl} from '../ui/format.js';
import {bottleStatusLabels} from '../domain/labels.js';
import {inventoryCountGroups} from '../domain/inventory-counts.js';
import {bottlingOriginLabel} from '../domain/bottling-origin.js';
import {hasBottlingDetail} from '../domain/bottling-details.js';
import {paginate, visiblePages, PAGE_SIZE_OPTIONS, homePageUrl} from '../domain/pagination.js';
import {savePageSizePreference} from '../domain/page-size-preference.js';
import {availableOverviewDistilleries, collectionOverviewEntries, purchasePrice, latestUpdate} from '../domain/collection-overview.js';
import {TABLE_COLUMNS, loadTableColumns, saveTableColumns, sortForColumn, normalizeTableColumns, DEFAULT_TABLE_COLUMNS} from '../domain/collection-table-columns.js';
import {displayedTastingRating, latestTasting} from '../../../shared/tasting-records.js';
import {glencairnRatingSymbol} from '../ui/glencairn-icon.js';
/**
 * The count labels represent mutually exclusive bottle types. Sample bottles
 * are not displayed again in the Standardflaschen count.
 */
function inventoryBadges(physicalBottles) {
  return inventoryCountGroups(physicalBottles)
    .map(group => `<span class="badge${group.type === 'sample' ? ' sample' : ''}${group.status === 'open' ? ' open' : ''}">${t(({"standard.closed": "home.badges.standardClosed", "standard.open": "home.badges.standardOpen", "sample.closed": "home.badges.sampleClosed", "sample.open": "home.badges.sampleOpen"})[`${group.type}.${group.status}`], {count: group.count})}</span>`)
    .join('');
}

/** Only supplied details are shown on cards and in the overview table. */
function overviewField(value, suffix = '') {
  return hasBottlingDetail(value) ? `${escapeHtml(value)}${suffix}` : '';
}

function overviewFacts(bottling) {
  return [
    hasBottlingDetail(bottling.ageYears) ? t('home.facts.years', {count: bottling.ageYears}) : '',
    overviewField(bottling.abv, ' % Vol.'),
  ].filter(Boolean);
}

/** Render a single table cell. The same field definitions power both table modes. */
function collectionTableCell(columnId, entry, allBottlingBottles, distilleryNames) {
  const {bottling, bottle} = entry;
  const displayedBottles = bottle ? [bottle] : allBottlingBottles;
  let value = '';
  switch (columnId) {
    case 'name': value = `<strong>${escapeHtml(bottling.name)}</strong>`; break;
    case 'inventory': value = bottle?.inventoryNumber ? `#${escapeHtml(bottle.inventoryNumber)}` : t('imports.bottles.noInventoryNumber'); break;
    case 'distillery': value = escapeHtml(bottlingOriginLabel(bottling, distilleryNames)); break;
    case 'age': value = overviewField(bottling.ageYears); break;
    case 'abv': value = overviewField(bottling.abv, ' %'); break;
    case 'year': value = overviewField(bottling.releaseYear); break;
    case 'stock': value = `<div class="inventory-badges">${inventoryBadges(displayedBottles)}</div>`; break;
    case 'editing': value = bottling.completionStatus === 'complete' ? t('detail.status.complete') : t('detail.status.incomplete'); break;
    case 'rating': {
      const score = displayedTastingRating(bottling);
      value = score == null || !Number.isFinite(Number(score)) ? '–' : escapeHtml(t('home.table.scoreValue', {
        score: new Intl.NumberFormat(currentLanguage() === 'de' ? 'de-DE' : 'en-US', {maximumFractionDigits: 2}).format(Number(score))
      }));
      break;
    }
    case 'status': value = bottle ? `<span class="badge ${escapeHtml(bottle.status || '')}">${escapeHtml(statusText(bottle.status))}</span>` : ''; break;
    case 'type': value = bottle ? t(bottle.volumeType === 'sample' ? 'imports.bottles.sample' : 'imports.bottles.standard') : ''; break;
    case 'size': value = bottle?.volumeMl != null ? `${escapeHtml(bottle.volumeMl)} ml` : ''; break;
    case 'price': {
      const price = purchasePrice(entry);
      value = price ? new Intl.NumberFormat(currentLanguage() === 'de' ? 'de-DE' : 'en-US', {style: 'currency', currency: price.currency}).format(price.value) : '–';
      break;
    }
    case 'updated':
    case 'tasted': {
      const date = columnId === 'updated' ? latestUpdate(entry) : latestTasting(bottling)?.tastedOn;
      value = date && Number.isFinite(new Date(date).getTime()) ? escapeHtml(new Date(date).toLocaleDateString(currentLanguage())) : '–';
      break;
    }
  }
  return `<td>${value}</td>`;
}

/** Compact, non-interactive rating shown inside the photo frame. */
export function collectionCardRating(bottling, photoId = null) {
  const score = displayedTastingRating(bottling);
  if (score == null || !Number.isFinite(Number(score))) return '';
  const safe = Math.min(100, Math.max(0, Number(score)));
  const unique = String(photoId || bottling.id || 'bottling').replace(/[^a-zA-Z0-9_-]/g, '-');
  const glasses = Array.from({length: 5}, (_, i) => {
    const fill = Math.max(0, Math.min(100, (safe - i * 20) * 5));
    return glencairnRatingSymbol({fill, id: `overview-rating-${unique}-${i}`});
  }).join('');
  return `<span class="collection-card-rating" role="img" aria-label="${escapeHtml(t('home.filters.ratingScore', {score: String(safe).replace('.', ',')}))}" title="${escapeHtml(t('home.filters.ratingScore', {score: String(safe).replace('.', ',')}))}">${glasses}</span>`;
}

/** Render only the necessary page controls; page content is loaded from local JSON. */
function pagerHtml({page, pageCount, total, from, to}, selectedSize, mode = 'bottlings') {
  const label = mode === 'bottles' ? t("forms.bottle.plural") : t("analytics.inventory.bottlings");
  const pageSizeLabel = mode === 'bottles' ? t("home.pagination.bottlesPerPage") : t("home.pagination.bottlingsPerPage");
  const button = (target, label, title, disabled = false) => `<button type="button" class="btn small pagination-button" data-page-to="${target}" aria-label="${title}" ${disabled ? 'disabled' : ''}>${label}</button>`;
  const pages = visiblePages(page, pageCount).map(number => number === '…'
    ? '<span class="pagination-ellipsis" aria-hidden="true">…</span>'
    : `<button type="button" class="btn small pagination-button${number === page ? ' current' : ''}" data-page-to="${number}" aria-label="${t("home.pagination.pageLabel", {page: number})}" ${number === page ? 'aria-current="page"' : ''}>${number}</button>`).join('');
  return `<nav class="collection-pagination" aria-label="${t("home.pagination.collectionPages")}">
        <span class="pagination-summary">${t("home.pagination.rangeSummary", {from, to, total, label})}</span>
        <div class="pagination-pages">
            ${button(1, chevronsLeftIcon, t('home.pagination.first'), page === 1)}
            ${button(Math.max(1, page - 1), chevronLeftIcon, t('home.pagination.previous'), page === 1)}
            ${pages}
            ${button(Math.min(pageCount, page + 1), chevronRightIcon, t('home.pagination.next'), page === pageCount)}
            ${button(pageCount, chevronsRightIcon, t('home.pagination.last'), page === pageCount)}
        </div>
        <label class="pagination-size">${pageSizeLabel}
            <select id="pagination-size" aria-label="${pageSizeLabel}">${PAGE_SIZE_OPTIONS.map(option => `<option value="${option}" ${option === selectedSize ? 'selected' : ''}>${option}</option>`).join('')}</select>
        </label>
    </nav>`;
}

/** Collection overview uses delegated root events; render does not bind listeners. */
export function createHomeView({state, selectors, shell, navigate, refresh, showModal, closeModal, confirm: confirmModal}) {
  const {allBottles, bottles, coverPhoto, distilleryNames} = selectors;
  let activeList = [];
  let activePageSize = 1;
  let filtersExpanded = false;
  const savedViews = () => state.collection?.settings?.savedViews || [];
  let flavorDraft = null;
  let columnPickerOpen = false;
  const columnSelection = loadTableColumns();
  function updatePageUrl(replace = false) {
    const url = homePageUrl(state.pageNumber, state.overviewMode);
    if (location.pathname + location.search !== url) {
      history[replace ? 'replaceState' : 'pushState']({whiskyRoute: true}, '', url);
    }
  }
  function changePage(target) {
    const next = paginate(activeList, target, activePageSize).page;
    if (next === state.pageNumber) return;
    state.pageNumber = next;
    updatePageUrl();
    home();
    document.querySelector('.collection-heading')?.scrollIntoView({block: 'start', behavior: 'auto'});
  }
  function captureView() {
    return {
      filters: {
        search: state.search, status: state.status, completion: state.completion,
        distillery: state.distillery, rating: state.rating, volumeType: state.volumeType,
        flavorCriteria: normalizeFlavorCriteria(state.flavorCriteria || []), profileMissing: !!state.profileMissing, profilePresent: !!state.profilePresent
      },
      display: {
        sort: state.sort, view: state.view, mode: state.overviewMode,
        columns: {bottlings: [...columnSelection.bottlings], bottles: [...columnSelection.bottles]}
      }
    };
  }
  async function storeViews(views) {
    try {
      await request('/api/settings/saved-views', {method: 'PUT', body: JSON.stringify({views})});
      await refresh('collection');
      home();
    } catch (error) {toast(error.message, true);}
  }
  function openSaveView() {
    showModal(t('collection.saved.saveTitle'), `<div class="collection-save-view-dialog">
            <label>${escapeHtml(t('collection.saved.name'))}<input data-view-name maxlength="80" required autocomplete="off"></label>
            <div class="actions"><button type="button" class="btn" data-act="close-modal">${t('common.actions.cancel')}</button>
            <button type="button" class="btn primary" data-act="collection-view-save-confirm">${t('common.actions.save')}</button></div></div>`, false);
  }
  async function saveCurrentView() {
    const field = document.querySelector('[data-view-name]');
    if (!field?.reportValidity() || !field.value.trim()) return;
    const id = globalThis.crypto?.randomUUID?.() || `view-${Date.now()}`;
    const views = [...savedViews(), {id, name: field.value.trim(), ...captureView()}];
    if (views.length > 40) return toast(t('collection.saved.limit'), true);
    closeModal();
    state.activeSavedViewId = id;
    await storeViews(views);
  }
  async function updateCurrentView() {
    const id = state.activeSavedViewId;
    if (!savedViews().some(view => view.id === id)) return;
    await storeViews(savedViews().map(view => view.id === id ? {...view, ...captureView()} : view));
  }
  function renameCurrentView() {
    const item = savedViews().find(view => view.id === state.activeSavedViewId);
    if (!item) return;
    showModal(t('collection.saved.rename'), `<div class="collection-save-view-dialog">
            <label>${t('collection.saved.name')}<input data-view-name maxlength="80" required value="${escapeHtml(item.name)}"></label>
            <div class="actions"><button class="btn" type="button" data-act="close-modal">${t('common.actions.cancel')}</button>
            <button class="btn primary" type="button" data-act="collection-view-rename-confirm">${t('common.actions.save')}</button></div></div>`, false);
  }
  async function confirmRenameView() {
    const name = document.querySelector('[data-view-name]');
    if (!name?.reportValidity() || !name.value.trim()) return;
    const id = state.activeSavedViewId;
    if (!savedViews().some(view => view.id === id)) return;
    closeModal();
    await storeViews(savedViews().map(view => view.id === id ? {...view, name: name.value.trim()} : view));
  }
  async function deleteCurrentView() {
    const id = state.activeSavedViewId;
    const item = savedViews().find(view => view.id === id);
    if (!item || !(await confirmModal(t('collection.saved.delete'), t('collection.saved.deleteConfirm', {name: item.name}), t('common.actions.delete')))) return;
    state.activeSavedViewId = null;
    await storeViews(savedViews().filter(view => view.id !== id));
  }
  function applySavedView(id) {
    if (!id) {resetStandardView(); return;}
    const item = savedViews().find(view => view.id === id);
    if (!item) {state.activeSavedViewId = null; home(); return;}
    for (const field of ['search', 'status', 'completion', 'distillery', 'rating', 'volumeType']) state[field] = item.filters[field];
    state.flavorCriteria = normalizeFlavorCriteria(item.filters.flavorCriteria);
    state.profileMissing = !!item.filters.profileMissing;
    state.profilePresent = !!item.filters.profilePresent;
    state.sort = item.display.sort;
    state.view = item.display.view;
    state.overviewMode = item.display.mode;
    for (const mode of ['bottlings', 'bottles']) columnSelection[mode] = normalizeTableColumns(mode, item.display.columns[mode]);
    saveTableColumns(columnSelection);
    state.activeSavedViewId = id;
    state.pageNumber = 1;
    updatePageUrl(true);
    home();
  }
  function planFromSelection() {
    state.flightCandidateIds = [...new Set(activeList.map(item => item.bottling.id))];
    navigate('tastings-home');
  }
  function profileStatus() {
    return state.profileMissing ? 'without' : state.profilePresent ? 'with' : 'all';
  }
  function newFlavorDraft() {
    return {status: profileStatus(), criteria: normalizeFlavorCriteria(state.flavorCriteria || [])};
  }
  function flavorEditorContent() {
    const draft = flavorDraft || newFlavorDraft();
    const available = FLAVOR_AXES.filter(axis => !draft.criteria.some(item => item.axis === axis));
    const statusOptions = [['all', 'collection.flavor.any'], ['with', 'collection.flavor.with'], ['without', 'collection.flavor.without']];
    const scoreOptions = (selected) => Array.from({length: 11}, (_, i) => `<option value="${i}" ${selected === i ? 'selected' : ''}>${i}/10</option>`).join('');
    return `<fieldset class="collection-flavor-status"><legend>${escapeHtml(t('collection.flavor.missing'))}</legend>
            <div class="collection-flavor-status-options">${statusOptions.map(([value, label]) => `<label><input type="radio" name="collection-profile-status" value="${value}" data-flavor-profile-status ${draft.status === value ? 'checked' : ''}><span>${escapeHtml(t(label))}</span></label>`).join('')}</div>
        </fieldset>
        <div class="collection-flavor-criteria" ${draft.status === 'without' ? 'hidden' : ''}>
            ${draft.criteria.map(item => `<div class="collection-flavor-row">
                <div class="collection-flavor-row-head"><strong>${escapeHtml(t(`flavor.axis.${item.axis}`))}</strong><button type="button" class="collection-flavor-remove" data-act="collection-flavor-remove" data-axis="${item.axis}" aria-label="${escapeHtml(t('collection.flavor.remove', {name: t(`flavor.axis.${item.axis}`)}))}">${closeIcon}</button></div>
                <div class="collection-flavor-range"><label>${escapeHtml(t('collection.flavor.min'))}<select data-flavor-axis="${item.axis}" data-flavor-part="min">${scoreOptions(item.min)}</select></label>
                <label>${escapeHtml(t('collection.flavor.max'))}<select data-flavor-axis="${item.axis}" data-flavor-part="max">${scoreOptions(item.max)}</select></label></div>
            </div>`).join('')}
            ${available.length ? `<div class="collection-flavor-add"><select id="collection-add-flavor-axis" aria-label="${escapeHtml(t('collection.flavor.axis'))}"><option value="" selected disabled>${escapeHtml(t('collection.flavor.selectAxis'))}</option>${available.map(axis => `<option value="${axis}">${escapeHtml(t(`flavor.axis.${axis}`))}</option>`).join('')}</select>
                <button type="button" class="btn" data-act="collection-flavor-add" disabled>${escapeHtml(t('collection.flavor.add'))}</button></div>` : ''}
        </div>
        <div class="collection-flavor-actions"><button type="button" class="btn" data-act="collection-flavor-reset">${escapeHtml(t('analytics.filters.reset'))}</button>
            <button type="button" class="btn primary" data-act="collection-flavor-apply">${escapeHtml(t('collection.flavor.apply'))}</button></div>`;
  }
  function flavorEditorHtml() {
    return `<div class="collection-flavor-editor" data-collection-flavor-editor>${flavorEditorContent()}</div>`;
  }
  function redrawFlavorEditor(focusSelector = null) {
    const editor = document.querySelector('[data-collection-flavor-editor]');
    if (!editor) return;
    const scrollTop = editor.closest('.collection-flavor-popover, .dialog')?.scrollTop || 0;
    editor.innerHTML = flavorEditorContent();
    const scroller = editor.closest('.collection-flavor-popover, .dialog');
    if (scroller) scroller.scrollTop = scrollTop;
    if (focusSelector) editor.querySelector(focusSelector)?.focus();
  }
  function openFlavorFilter() {
    flavorDraft = newFlavorDraft();
    showModal(t('collection.flavor.title'), flavorEditorHtml(), false);
  }
  function addFlavorCriterion() {
    const axis = document.querySelector('[data-collection-flavor-editor] #collection-add-flavor-axis')?.value;
    if (!flavorDraft || !FLAVOR_AXES.includes(axis) || flavorDraft.criteria.some(item => item.axis === axis)) return;
    flavorDraft.criteria.push({axis, min: 0, max: 10});
    if (flavorDraft.status === 'without') flavorDraft.status = 'with';
    redrawFlavorEditor('[data-act="collection-flavor-remove"][data-axis="' + axis + '"]');
  }
  function removeFlavorCriterion(axis) {
    if (!flavorDraft) return;
    flavorDraft.criteria = flavorDraft.criteria.filter(item => item.axis !== axis);
    redrawFlavorEditor('#collection-add-flavor-axis');
  }
  function changeFlavorCriterion(input) {
    if (!flavorDraft) return;
    const axis = input.dataset.flavorAxis;
    const part = input.dataset.flavorPart;
    const entry = flavorDraft.criteria.find(item => item.axis === axis);
    const value = Number(input.value);
    if (!entry || !['min', 'max'].includes(part) || !Number.isInteger(value) || value < 0 || value > 10) return;
    entry[part] = part === 'min' ? Math.min(value, entry.max) : Math.max(value, entry.min);
    redrawFlavorEditor(`[data-flavor-axis="${axis}"][data-flavor-part="${part}"]`);
  }
  function changeFlavorStatus(value) {
    if (!flavorDraft || !['all', 'with', 'without'].includes(value)) return;
    flavorDraft.status = value;
    redrawFlavorEditor(`[data-flavor-profile-status][value="${value}"]`);
  }
  function resetFlavorDraft() {
    flavorDraft = {status: 'all', criteria: []};
    redrawFlavorEditor('[data-flavor-profile-status][value="all"]');
  }
  function applyFlavorDraft() {
    if (!flavorDraft) return;
    state.profileMissing = flavorDraft.status === 'without';
    state.profilePresent = flavorDraft.status === 'with';
    state.flavorCriteria = state.profileMissing ? [] : normalizeFlavorCriteria(flavorDraft.criteria);
    flavorDraft = null;
    state.pageNumber = 1;
    if (document.querySelector('#modal-root [data-collection-flavor-editor]')) closeModal();
    home();
  }
  function resetStandardView() {
    for (const field of ['status', 'completion', 'distillery', 'rating', 'volumeType']) state[field] = 'all';
    state.search = ''; state.sort = 'name'; state.flavorCriteria = [];
    state.profileMissing = false; state.profilePresent = false;
    state.activeSavedViewId = null; state.pageNumber = 1;
    home();
  }
  function activeViewChanged() {
    const saved = savedViews().find(item => item.id === state.activeSavedViewId);
    if (!saved) return false;
    const current = captureView();
    return JSON.stringify(current.filters) !== JSON.stringify({...saved.filters, profilePresent: !!saved.filters.profilePresent}) ||
      JSON.stringify(current.display) !== JSON.stringify(saved.display);
  }
  function savedViewsMenuHtml() {
    const current = savedViews().find(item => item.id === state.activeSavedViewId);
    const dirty = current && activeViewChanged();
    const label = current?.name || t('collection.saved.standard');
    const bookmark = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5h12v17l-6-4-6 4z"/></svg>';
    return `<details class="collection-saved-menu" id="collection-saved-views"><summary aria-label="${escapeHtml(t('collection.saved.title'))}: ${escapeHtml(label)}">${bookmark}<span class="collection-saved-label">${escapeHtml(t('collection.saved.view'))}: <strong>${escapeHtml(label)}</strong></span>${dirty ? `<span class="collection-saved-dirty">${escapeHtml(t('collection.saved.changed'))}</span>` : ''}${chevronDownIcon('collection-menu-chevron')}</summary>
            <div class="collection-saved-dropdown" role="group" aria-label="${escapeHtml(t('collection.saved.title'))}">
                <button type="button" class="collection-saved-item${!current ? ' is-active' : ''}" data-act="collection-view-apply" data-id="">${escapeHtml(t('collection.saved.standard'))}</button>
                ${savedViews().map(view => `<button type="button" class="collection-saved-item${current?.id === view.id ? ' is-active' : ''}" data-act="collection-view-apply" data-id="${escapeHtml(view.id)}">${escapeHtml(view.name)}</button>`).join('')}
                <div class="collection-saved-divider"></div>
                <button type="button" class="collection-saved-item" data-act="collection-view-save">${escapeHtml(t('collection.saved.save'))}</button>
                ${current ? `<button type="button" class="collection-saved-item" data-act="collection-view-update">${escapeHtml(t('collection.saved.update'))}</button><button type="button" class="collection-saved-item" data-act="collection-view-rename">${escapeHtml(t('collection.saved.rename'))}</button><button type="button" class="collection-saved-item collection-saved-danger" data-act="collection-view-delete">${escapeHtml(t('collection.saved.delete'))}</button>` : ''}
            </div>
        </details>`;
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
    if (button.dataset.act === 'collection-sort-column') {
      const mode = state.overviewMode === 'bottles' ? 'bottles' : 'bottlings';
      const column = TABLE_COLUMNS[mode].find(item => item.id === button.dataset.column);
      if (!column) return;
      state.sort = sortForColumn(column, state.sort);
      // A previous checkbox change leaves the picker open in its view
      // state. Sorting a header must close it instead of reopening it.
      columnPickerOpen = false;
      state.pageNumber = 1;
      updatePageUrl(true);
      home();
      return;
    }
    if (button.dataset.act === 'collection-columns-default') {
      const mode = state.overviewMode === 'bottles' ? 'bottles' : 'bottlings';
      columnSelection[mode] = [...DEFAULT_TABLE_COLUMNS[mode]];
      columnPickerOpen = true;
      saveTableColumns(columnSelection);
      home();
      return;
    }
    if (button.dataset.resetCollectionFlavorAxis) {
      const axis = button.dataset.resetCollectionFlavorAxis;
      state.flavorCriteria = (state.flavorCriteria || []).filter(item => item.axis !== axis);
      state.pageNumber = 1; home(); return;
    }
    if (button.dataset.resetCollectionFilter) {
      const key = button.dataset.resetCollectionFilter;
      if (!['status', 'completion', 'distillery', 'rating', 'volumeType', 'flavor', 'profileMissing', 'profilePresent'].includes(key)) return;
      if (key === 'flavor') state.flavorCriteria = [];
      else if (key === 'profileMissing') state.profileMissing = false;
      else if (key === 'profilePresent') state.profilePresent = false;
      else state[key] = 'all';
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
    if (input.dataset?.collectionColumn) {
      const mode = state.overviewMode === 'bottles' ? 'bottles' : 'bottlings';
      const id = input.dataset.collectionColumn;
      if (!TABLE_COLUMNS[mode].some(column => column.id === id)) return;
      const selected = new Set(columnSelection[mode]);
      if (input.checked) selected.add(id);
      else if (selected.size > 1) selected.delete(id);
      else {input.checked = true; return;} // Keep at least one visible column.
      columnSelection[mode] = normalizeTableColumns(mode, [...selected]);
      columnPickerOpen = true;
      saveTableColumns(columnSelection);
      home();
      return;
    }
    if (input.dataset?.flavorProfileStatus != null) {changeFlavorStatus(input.value); return;}
    if (input.id === 'collection-add-flavor-axis') {
      const button = input.closest('[data-collection-flavor-editor]')?.querySelector('[data-act="collection-flavor-add"]');
      if (button) button.disabled = !FLAVOR_AXES.includes(input.value);
      return;
    }
    if (input.dataset?.flavorAxis) {changeFlavorCriterion(input); return;}
    if (input.id === 'pagination-size') {
      state.pageSize = Number(input.value);
      savePageSizePreference(state.pageSize);
    } else {
      const field = {
        'filter-status': 'status', 'filter-completion': 'completion', 'filter-sort': 'sort',
        'filter-distillery': 'distillery', 'filter-volume-type': 'volumeType', 'filter-rating': 'rating'
      }[input.id];
      if (!field) return;
      state[field] = input.value;
    }
    state.pageNumber = 1;
    updatePageUrl(true);
    home();
    if (input.id === 'pagination-size') document.querySelector('.collection-heading')?.scrollIntoView({block: 'start', behavior: 'auto'});
  }
  function handleInput(input) {
    if (state.page !== 'home' || input.id !== 'search') return;
    state.search = input.value;
    state.pageNumber = 1;
    updatePageUrl(true);
    const cursor = input.selectionStart;
    home();
    const node = document.getElementById('search');
    if (node) {node.focus(); node.setSelectionRange(cursor, cursor);}
  }
  function home() {
    const collection = state.collection;
    const physical = allBottles();
    const total = physical.length, open = physical.filter(entry => entry.status === 'open').length, closed = physical.filter(entry => entry.status === 'closed').length;
    const establishedYear = collection.settings?.establishedYear;
    const mode = state.overviewMode === 'bottles' ? 'bottles' : 'bottlings';
    const selectedColumns = TABLE_COLUMNS[mode].filter(column => columnSelection[mode].includes(column.id));
    const label = mode === 'bottles' ? t("forms.bottle.plural") : t("analytics.inventory.bottlings");
    const distilleries = availableOverviewDistilleries(collection);
    // Do not keep a deleted distillery selected after refreshing the collection.
    if (state.distillery !== 'all' && !distilleries.some(item => item.id === state.distillery)) {
      state.distillery = 'all';
    }
    // The mode changes the unit of filtering, counting and pagination, not the collection data.
    const list = collectionOverviewEntries(collection, {
      mode, search: state.search, status: state.status, completion: state.completion,
      sort: state.sort, distillery: state.distillery, volumeType: state.volumeType, rating: state.rating,
      flavorCriteria: state.flavorCriteria, profileMissing: state.profileMissing, profilePresent: state.profilePresent, distilleryNames,
    });
    const pageSize = state.pageSize;
    const pageData = paginate(list, state.pageNumber, pageSize);
    if (state.pageNumber !== pageData.page) {
      state.pageNumber = pageData.page;
      history.replaceState({whiskyRoute: true}, '', homePageUrl(pageData.page, mode));
    }
    const visibleList = pageData.items;
    activeList = list;
    activePageSize = pageSize;
    const cards = visibleList.map(({bottling, bottle}) => {
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
      return `<article tabindex="0" class="whisky-card" data-act="open" data-id="${escapeHtml(bottling.id)}"${bottle ? ` data-bottle-id="${escapeHtml(bottle.id)}" aria-label="${escapeHtml(t("home.image.bottleAccessibleName", {name: bottling.name, number: bottle.inventoryNumber || t("home.inventory.withoutInventoryNumber")}))}"` : ''}>
    <div class="card-img">${photo ? `<img src="${imageUrl(photo)}" alt="${escapeHtml(t("home.image.bottleAlt", {name: bottling.name}))}" loading="lazy">` : '<img class="image-placeholder" src="/assets/photo-placeholder.svg" alt="" aria-hidden="true">'}${collectionCardRating(bottling, bottle?.id)}</div>
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
    const rows = visibleList.map(({bottling, bottle}) => {
      const entry = {bottling, bottle};
      const attrs = `class="clickable" tabindex="0" data-act="open" data-id="${escapeHtml(bottling.id)}"${bottle ? ` data-bottle-id="${escapeHtml(bottle.id)}" aria-label="${escapeHtml(t('home.image.bottleAccessibleName', {name: bottling.name, number: bottle.inventoryNumber || t('home.inventory.withoutInventoryNumber')}))}"` : ''}`;
      const cells = selectedColumns.map(column => collectionTableCell(column.id, entry, bottle ? [bottle] : bottles(bottling.id), distilleryNames)).join('');
      return `<tr ${attrs}>${cells}</tr>`;
    }).join('');
    const tableHead = selectedColumns.map(column => {
      const active = state.sort === column.asc || state.sort === column.desc;
      const descending = state.sort === column.desc;
      const title = t(column.label);
      return `<th scope="col"${active ? ` aria-sort="${descending ? 'descending' : 'ascending'}"` : ''}><button type="button" class="collection-table-sort${active ? ' is-active' : ''}" data-act="collection-sort-column" data-column="${column.id}" aria-label="${escapeHtml(t('home.table.sortBy', {name: title}))}">${escapeHtml(title)}<span class="collection-table-sort-direction" aria-hidden="true">${active ? (descending ? arrowDownIcon : arrowUpIcon) : arrowsUpDownIcon}</span></button></th>`;
    }).join('');
    const columnPicker = `<div class="collection-table-tools"><details class="collection-table-columns"${columnPickerOpen ? ' open' : ''}>
            <summary aria-label="${t('home.table.selectColumns')}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M10 4v16M16 4v16"/></svg>${t('home.table.columns')}<svg class="collection-table-columns-chevron" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary>
            <div class="collection-table-columns-menu" role="group" aria-label="${t('home.table.selectColumns')}">
                ${TABLE_COLUMNS[mode].map(column => `<label class="collection-table-column-choice"><input type="checkbox" data-collection-column="${column.id}" ${columnSelection[mode].includes(column.id) ? 'checked' : ''}>${escapeHtml(t(column.label))}</label>`).join('')}
                <button type="button" class="btn small collection-table-columns-reset" data-act="collection-columns-default">${t('home.table.resetColumns')}</button>
            </div>
        </details></div>`;
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
    ${pageHeader({
      title: t("home.collection.title"), eyebrow: t("home.hero.archiveEyebrow"), intro: t("home.hero.everyBottlingHasStory"),
      className: 'collection-heading', copyClass: '', actions: `<div class="collection-mode-toggle" role="group" aria-label="${t("home.view.displayAs")}">
    <button type="button" class="collection-mode-button${mode === 'bottlings' ? ' active' : ''}" data-collection-mode="bottlings" aria-pressed="${mode === 'bottlings'}">${t("analytics.inventory.bottlings")} <span class="collection-mode-count">${collection.bottlings.length}</span></button>
    <button type="button" class="collection-mode-button${mode === 'bottles' ? ' active' : ''}" data-collection-mode="bottles" aria-pressed="${mode === 'bottles'}">${t("forms.bottle.plural")} <span class="collection-mode-count">${total}</span></button>
    </div>`})}
    <div class="stats">
    ${[
        [t("analytics.inventory.bottlings"), collection.bottlings.length],
        [t("home.inventory.totalStock"), total],
        [t("home.status.closed"), closed],
        [t("analytics.inventory.openedStatus"), open]
      ].map(([label, value]) => contentPanel({className: 'stat', content: `<span>${label}</span><strong>${value}</strong>`})).join('')}
    </div>
    ${(() => {
        const distillery = distilleries.find(item => item.id === state.distillery);
        const rating = state.rating === 'unrated' ? t('home.filters.unrated') :
          ['1', '2', '3', '4', '5'].includes(state.rating) ? t('home.filters.ratingRange', {
            from: state.rating === '1' ? '0' : `${(Number(state.rating) - 1) * 20},1`,
            to: Number(state.rating) * 20
          }) : null;
        const active = [
          ['status', state.status !== 'all' ? statusText(state.status) : null, t('forms.bottle.status')],
          ['completion', state.completion === 'complete' ? t('detail.status.complete') : state.completion === 'incomplete' ? t('detail.status.incomplete') : null, t('home.filters.completeness')],
          ['distillery', distillery?.name, t('home.filters.filterDistillery')],
          ['rating', rating, t('home.filters.filterRating')],
          ['volumeType', state.volumeType === 'sample' ? t('analytics.inventory.samples') : state.volumeType === 'standard' ? t('home.inventory.standardBottles') : null, t('home.filters.filterBottleType')],
          ...((state.flavorCriteria || []).map(item => [`flavor-axis:${item.axis}`, `${t(`flavor.axis.${item.axis}`)} ${item.min}–${item.max}`, t('collection.flavor.title')])),
          ['profileMissing', state.profileMissing ? t('collection.flavor.without') : null, t('collection.flavor.title')],
          ['profilePresent', state.profilePresent ? t('collection.flavor.with') : null, t('collection.flavor.title')],
        ].filter(([, value]) => value);
        return `<div class="toolbar collection-filters" data-expanded="${filtersExpanded}" aria-label="${escapeHtml(t('home.filters.filters'))}">
    <div class="collection-filter-heading"><span class="collection-filter-heading-label">${escapeHtml(t('home.filters.filters'))}</span>${savedViewsMenuHtml()}</div>
    <input type="search" id="search" aria-label="${t('home.filters.searchCollection')}" placeholder="${t('home.filters.searchPlaceholder')}" value="${escapeHtml(state.search)}">
    <select id="filter-sort" aria-label="${t('home.sort.title')}">
    ${[
            ['name', 'home.sort.nameAscending'],
            ['nameDesc', 'home.sort.nameDescending'],
            ['inventoryAsc', 'home.sort.inventoryAscending'],
            ['inventoryDesc', 'home.sort.inventoryDescending'],
            ['distillery', 'home.sort.distilleryAscending'],
            ['distilleryDesc', 'home.sort.distilleryDescending'],
            ['priceAsc', mode === 'bottles' ? 'home.sort.priceAscending' : 'home.sort.averagePriceAscending'],
            ['priceDesc', mode === 'bottles' ? 'home.sort.priceDescending' : 'home.sort.averagePriceDescending'],
            ['scoreDesc', 'home.sort.scoreDescending'],
            ['scoreAsc', 'home.sort.scoreAscending'],
            ['updatedDesc', 'home.sort.updatedDescending'],
            ['updatedAsc', 'home.sort.updatedAscending'],
            ['tastedDesc', 'home.sort.tastedDescending'],
            ['tastedAsc', 'home.sort.tastedAscending'],
            ['newest', 'home.sort.newestFirst'],
            ['age', 'home.sort.ageDescending'],
            ['ageAsc', 'home.sort.ageAscending'],
            ['abvAsc', 'home.sort.abvAscending'],
            ['abvDesc', 'home.sort.abvDescending'],
            ['year', 'home.sort.yearDescending'],
            ['yearAsc', 'home.sort.yearAscending'],
            ['stockAsc', 'home.sort.stockAscending'],
            ['stockDesc', 'home.sort.stockDescending'],
            ['completionAsc', 'home.sort.completionAscending'],
            ['completionDesc', 'home.sort.completionDescending'],
            ['statusAsc', 'home.sort.statusAscending'],
            ['statusDesc', 'home.sort.statusDescending'],
            ['volumeTypeAsc', 'home.sort.typeAscending'],
            ['volumeTypeDesc', 'home.sort.typeDescending'],
            ['volumeMlAsc', 'home.sort.sizeAscending'],
            ['volumeMlDesc', 'home.sort.sizeDescending'],
          ].map(([value, key]) => `<option value="${value}" ${state.sort === value ? 'selected' : ''}>${t(key)}</option>`).join('')}
    </select>
    <select id="filter-status" aria-label="${t('forms.bottle.status')}">
    <option value="all">${t('home.filters.allStatuses')}</option>${Object.entries(bottleStatusLabels).map(([k]) => `<option value="${k}" ${state.status === k ? 'selected' : ''}>${statusText(k)}</option>`).join('')}</select>
    <select id="filter-completion" aria-label="${t('home.filters.completeness')}">
    <option value="all">${t('home.filters.allEntries')}</option>
    <option value="incomplete" ${state.completion === 'incomplete' ? 'selected' : ''}>${t('detail.status.incomplete')}</option>
    <option value="complete" ${state.completion === 'complete' ? 'selected' : ''}>${t('detail.status.complete')}</option>
    </select>
    <button type="button" class="btn collection-filter-toggle" data-act="toggle-collection-filters" aria-expanded="${filtersExpanded}" aria-controls="collection-filter-extra"><svg class="collection-filter-icon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/></svg><span class="collection-filter-toggle-desktop">${t('home.filters.moreFilters')}</span><span class="collection-filter-toggle-mobile">${t('home.filters.filters')}</span><svg class="collection-filter-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
    <button class="btn collection-filter-view" type="button" data-act="toggle-view" aria-label="${state.view === 'cards' ? t('home.view.table') : t('home.view.cards')}" title="${state.view === 'cards' ? t('home.view.table') : t('home.view.cards')}">${state.view === 'cards' ? collectionTableIcon : collectionCardsIcon} <span class="collection-filter-view-text">${state.view === 'cards' ? t('home.view.table') : t('home.view.cards')}</span></button>
    <div class="collection-filter-extra" id="collection-filter-extra" role="group" aria-label="${t('home.filters.moreFilters')}">
        <select id="filter-distillery" aria-label="${t('home.filters.filterDistillery')}">
        <option value="all">${t('home.filters.allDistilleries')}</option>
        ${distilleries.map(item => `<option value="${escapeHtml(item.id)}" ${state.distillery === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
        </select>
        <select id="filter-rating" aria-label="${t('home.filters.filterRating')}">
        <option value="all" ${state.rating === 'all' ? 'selected' : ''}>${t('home.filters.allRatings')}</option>
        ${[1, 2, 3, 4, 5].map(level => `<option value="${level}" ${state.rating === String(level) ? 'selected' : ''}>${t('home.filters.ratingRange', {from: level === 1 ? '0' : `${(level - 1) * 20},1`, to: level * 20})}</option>`).join('')}
        <option value="unrated" ${state.rating === 'unrated' ? 'selected' : ''}>${t('home.filters.unrated')}</option>
        </select>
        <select id="filter-volume-type" aria-label="${t('home.filters.filterBottleType')}">
        <option value="all" ${state.volumeType === 'all' ? 'selected' : ''}>${t('home.filters.allBottleTypes')}</option>
        <option value="standard" ${state.volumeType === 'standard' ? 'selected' : ''}>${t('home.inventory.standardBottles')}</option>
        <option value="sample" ${state.volumeType === 'sample' ? 'selected' : ''}>${t('analytics.inventory.samples')}</option>
        </select>
        <details class="collection-flavor-picker" data-collection-flavor-picker>
            <summary class="collection-flavor-trigger">${escapeHtml(t('collection.flavor.filter'))}${(state.flavorCriteria || []).length ? ` (${state.flavorCriteria.length})` : ''}${state.profileMissing || state.profilePresent ? ' •' : ''}${chevronDownIcon('collection-flavor-chevron')}</summary>
            <div class="collection-flavor-popover" role="group" aria-label="${escapeHtml(t('collection.flavor.title'))}">
                <div class="collection-flavor-popover-head"><strong>${escapeHtml(t('collection.flavor.filter'))}</strong><button type="button" class="collection-popover-close" data-act="collection-flavor-close" aria-label="${escapeHtml(t('common.actions.close'))}">${closeIcon}</button></div>
                ${flavorEditorHtml()}
            </div>
        </details>
        <button type="button" class="btn collection-flavor-mobile-trigger" data-act="collection-flavor-open">${escapeHtml(t('collection.flavor.filter'))}${(state.flavorCriteria || []).length ? ` (${state.flavorCriteria.length})` : ''}${state.profileMissing || state.profilePresent ? ' •' : ''}</button>
    </div>
    ${active.length ? `<div class="collection-filter-active" aria-label="${t('home.filters.activeFilters')}">${active.map(([key, value, label]) => `<button type="button" class="collection-filter-chip" ${key.startsWith('flavor-axis:') ? `data-reset-collection-flavor-axis="${escapeHtml(key.slice(12))}"` : `data-reset-collection-filter="${key}"`} aria-label="${escapeHtml(t('home.filters.removeFilter', {name: `${label}: ${value}`}))}">${escapeHtml(value)} ${closeIcon}</button>`).join('')}</div>` : ''}
    </div>`;
      })()}<div class="collection-results-heading">
        <span class="collection-results-count">${escapeHtml(t('collection.results.count', {count: list.length, label}))}</span>
        <div class="collection-results-actions"><button type="button" class="btn small" data-act="collection-flight-plan" ${list.length ? '' : 'disabled'}>${flightPlanIcon}<span>${escapeHtml(t('collection.results.planFlight'))}</span></button>
        ${state.view === 'table' && list.length ? columnPicker : ''}</div>
    </div>${pageData.pageCount > 1 ? `<div class="pagination-topline">
        <span>${t("home.pagination.rangeSummary", {from: pageData.from, to: pageData.to, total: pageData.total, label})}</span>
        <div class="pagination-topactions">
            <button type="button" class="btn small" data-page-to="${Math.max(1, pageData.page - 1)}" ${pageData.page === 1 ? 'disabled' : ''} aria-label="${t("home.pagination.previousPageLabel")}">${chevronLeftIcon}</button>
            <span>${t("home.pagination.pageOf", {page: pageData.page, total: pageData.pageCount})}</span>
            <button type="button" class="btn small" data-page-to="${Math.min(pageData.pageCount, pageData.page + 1)}" ${pageData.page === pageData.pageCount ? 'disabled' : ''} aria-label="${t("home.pagination.nextPageLabel")}">${chevronRightIcon}</button>
        </div>
    </div>` : ''}${list.length ? (state.view === 'cards' ? `<div class="grid">${cards}</div>` : `<div class="table-wrap collection-table-wrap">
    <table>
    <thead><tr>${tableHead}</tr></thead>
    <tbody>${rows}</tbody>
    </table>
    </div>`) : emptyState({
        variant: 'collection',
        title: list.length === 0 && mode === 'bottles' && !physical.length && collection.bottlings.length ? t("home.empty.noPhysicalBottles") : collection.bottlings.length ? t("home.empty.noMatchingEntries") : t("home.empty.noBottles"),
        description: mode === 'bottles' && !physical.length && collection.bottlings.length ? t("home.empty.addBottleToExistingHint") : collection.bottlings.length ? t("home.filters.changeFiltersHint") : t("home.empty.getStartedHint"),
        actions: collection.bottlings.length ? '' : `<button class="btn primary" data-act="new">${t("collection.actions.newBottle")}</button>`
      })}${pageData.total ? pagerHtml(pageData, state.pageSize, mode) : ''}`);

    // DOM reconciliation preserves form nodes to avoid scroll/focus jumps.
    // Native SELECT/INPUT properties can retain a stale user-edited value
    // even after their option attributes were reconciled (e.g. a saved
    // view restored "all" after an earlier "open" selection).
    for (const [id, value] of Object.entries({
      'search': state.search, 'filter-sort': state.sort, 'filter-status': state.status,
      'filter-completion': state.completion, 'filter-distillery': state.distillery,
      'filter-rating': state.rating, 'filter-volume-type': state.volumeType,
    })) {
      const field = typeof document !== 'undefined' ? document.getElementById?.(id) : null;
      if (field && field.value !== String(value)) field.value = String(value);
    }

    // A <details> element toggles natively when its summary is clicked.
    // Keep the view state aligned with the actual open/closed state, so a
    // subsequent table sort or filter render cannot reopen a closed picker.
    const flavorPicker = typeof document === 'undefined' ? null : document.querySelector?.('[data-collection-flavor-picker]');
    flavorPicker?.addEventListener?.('toggle', () => {
      if (flavorPicker.isConnected === false) return;
      if (flavorPicker.open) {flavorDraft = newFlavorDraft(); redrawFlavorEditor();}
      else flavorDraft = null;
    });
    const picker = typeof document === 'undefined' ? null : document.querySelector?.('.collection-table-columns');
    picker?.addEventListener?.('toggle', () => {
      if (picker.isConnected === false) return; // Ignore retired render trees.
      columnPickerOpen = picker.open;
    });
  }
  home.handleClick = handleClick;
  home.handleChange = handleChange;
  home.handleInput = handleInput;
  home.openSaveView = openSaveView;
  home.saveCurrentView = saveCurrentView;
  home.updateCurrentView = updateCurrentView;
  home.renameCurrentView = renameCurrentView;
  home.confirmRenameView = confirmRenameView;
  home.deleteCurrentView = deleteCurrentView;
  home.addFlavorCriterion = addFlavorCriterion;
  home.openFlavorFilter = openFlavorFilter;
  home.resetFlavorDraft = resetFlavorDraft;
  home.applyFlavorDraft = applyFlavorDraft;
  home.closeFlavorFilter = () => {const picker = document.querySelector('[data-collection-flavor-picker]'); if (picker) picker.open = false; flavorDraft = null;};
  home.changeFlavorStatus = changeFlavorStatus;
  home.applySavedView = applySavedView;
  home.removeFlavorCriterion = removeFlavorCriterion;
  home.planFromSelection = planFromSelection;
  return home;
}
