import {createCollectionViewModel} from './models/home.js';
import {composeMarkup} from '../ui/render-plan.js';
import {replaceContent} from '../ui/dom-renderer.js';
import {actionButton} from '../ui/buttons.js';
import {pageHeader} from '../ui/headers.js';
import {request} from '../api.js';
import {toast} from '../ui/notifications.js';
import {FLAVOR_AXES} from '../../../shared/flavor-profile.js';
import {normalizeFlavorCriteria}
  from '../../../shared/collection-saved-views.js';
import {displayPhotoPath} from '../../../shared/photo-images.js';
import {t, currentLanguage} from '../i18n/index.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates('collection/home.html');

/**
 * Derives the status text result from the supplied values.
 *
 * @param {*} status Status value determining the next action.
 * @return {*} Result computed from the supplied inputs.
 */
const statusText = status => t(({
  closed: 'home.status.closed',
  open: 'analytics.inventory.openedStatus',
  empty: 'home.status.empty',
})[status] || 'features.distilleries.unknownStatus');
import {
  newBottlingIcon, inventoryScanIcon, chevronDownIcon, chevronLeftIcon,
  chevronRightIcon, chevronsLeftIcon, chevronsRightIcon, arrowUpIcon,
  arrowDownIcon, arrowsUpDownIcon, closeIcon, collectionTableIcon,
  collectionCardsIcon, flightPlanIcon
} from '../ui/action-icons.js';
import {escapeHtml, query} from '../ui/dom.js';
import {emptyState, panel as contentPanel} from '../ui/content.js';
import {imageUrl} from '../ui/format.js';
import {bottleStatusLabels} from '../domain/labels.js';
import {inventoryCountGroups} from '../domain/inventory-counts.js';
import {bottlingOriginLabel} from '../domain/bottling-origin.js';
import {hasBottlingDetail} from '../domain/bottling-details.js';
import {paginate, visiblePages, PAGE_SIZE_OPTIONS, homePageUrl}
  from '../domain/pagination.js';
import {savePageSizePreference} from '../domain/page-size-preference.js';
import {
  purchasePrice, latestUpdate
} from '../domain/collection-overview.js';
import {
  TABLE_COLUMNS, loadTableColumns, saveTableColumns, sortForColumn,
  normalizeTableColumns, DEFAULT_TABLE_COLUMNS
}
  from '../domain/collection-table-columns.js';
import {displayedTastingRating, latestTasting}
  from '../../../shared/tasting-records.js';
import {glencairnRatingSymbol} from '../ui/glencairn-icon.js';
/**
 * The count labels represent mutually exclusive bottle types. Sample bottles
 * are not displayed again in the Standardflaschen count.
 *
 * @param {*} physicalBottles Physical bottles used by this operation.
 * @return {string} Resulting text.
 */
function inventoryBadges(physicalBottles) {
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
 * @return {string} Resulting text.
 */
function overviewField(value, suffix = '') {
  return hasBottlingDetail(value) ? `${escapeHtml(value)}${suffix}` : '';
}

/**
 * Filters records according to the overview facts selection rules.
 *
 * @param {*} bottling Bottling record being inspected or updated.
 * @return {!Array<*>} Resulting entries in their output order.
 */
function overviewFacts(bottling) {
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
 * @param {*} entry Entry to include in the calculation.
 * @param {*} allBottlingBottles All bottling bottles used by this operation.
 * @param {*} distilleryNames Distillery names used by this operation.
 * @return {string} Resulting text.
 */
function collectionTableCell(columnId, entry, allBottlingBottles,
  distilleryNames) {
  const {bottling, bottle} = entry;
  const displayedBottles = bottle ? [bottle] : allBottlingBottles;
  let value = '';
  switch (columnId) {
    case 'name': value = renderTemplate('strong', {name: bottling.name, }); break;
    case 'inventory': value = bottle?.inventoryNumber ? `#${escapeHtml(bottle.inventoryNumber)}` : t('imports.bottles.noInventoryNumber'); break;
    case 'distillery': value = escapeHtml(bottlingOriginLabel(bottling, distilleryNames)); break;
    case 'age': value = overviewField(bottling.ageYears); break;
    case 'abv': value = overviewField(bottling.abv, ' %'); break;
    case 'year': value = overviewField(bottling.releaseYear); break;
    case 'stock': value = renderTemplate('inventoryBadges', {inventoryBadges: inventoryBadges(displayedBottles), }); break;
    case 'editing': value = bottling.completionStatus === 'complete' ? t('detail.status.complete') : t('detail.status.incomplete'); break;
    case 'rating': {
      const score = displayedTastingRating(bottling);
      value = score == null || !Number.isFinite(Number(score)) ? '–' :
        escapeHtml(t(
          'home.table.scoreValue',
          {
            score: new Intl.NumberFormat(currentLanguage() === 'de' ? 'de-DE' : 'en-US', {maximumFractionDigits: 2}).format(Number(score)),
          }
        ));
      break;
    }
    case 'status': value = bottle ?
      renderTemplate('badge2', {
        status: bottle.status || '',
        statusText: statusText(bottle.status),
      }) : ''; break;
    case 'type': value = bottle ? t(bottle.volumeType === 'sample' ? 'imports.bottles.sample' : 'imports.bottles.standard') : ''; break;
    case 'size': value = bottle?.volumeMl != null ? `${escapeHtml(bottle.volumeMl)} ml` : ''; break;
    case 'price': {
      const price = purchasePrice(entry);
      value = price ? new Intl.NumberFormat(
        currentLanguage() === 'de' ? 'de-DE' : 'en-US',
        {style: 'currency', currency: price.currency}
      ).format(price.value) : '–';
      break;
    }
    case 'updated':
    case 'tasted': {
      const date = columnId === 'updated' ? latestUpdate(entry) : latestTasting(bottling)?.tastedOn;
      value = date && Number.isFinite(new Date(date).getTime()) ?
        escapeHtml(new Date(date).toLocaleDateString(currentLanguage())) : '–';
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
 * @return {string} Resulting text.
 */
export function collectionCardRating(bottling, photoId = null) {
  const score = displayedTastingRating(bottling);
  if (score == null || !Number.isFinite(Number(score))) return '';
  const safe = Math.min(100, Math.max(0, Number(score)));
  const unique = String(photoId || bottling.id || 'bottling').replace(/[^a-zA-Z0-9_-]/g, '-');
  const glasses = composeMarkup(Array.from({length: 5}, (_, i) => {
    const fill = Math.max(0, Math.min(100, (safe - i * 20) * 5));
    return glencairnRatingSymbol({fill, id: `overview-rating-${unique}-${i}`});
  }));
  return renderTemplate('collectionCardRating', {
    ratingScore: t('home.filters.ratingScore', {score: String(safe).replace('.', ','), }),
    ratingScore2: t('home.filters.ratingScore', {score: String(safe).replace('.', ','), }),
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
 * @return {string} Resulting text.
 */
function pagerHtml({page, pageCount, total, from, to}, selectedSize,
  mode = 'bottlings') {
  const label = mode === 'bottles' ? t("forms.bottle.plural") : t("analytics.inventory.bottlings");
  const pageSizeLabel = mode === 'bottles' ? t("home.pagination.bottlesPerPage") : t("home.pagination.bottlingsPerPage");
  /**
   * Produces the button text used by the caller.
   *
   * @param {*} target Target of the operation.
   * @param {*} label Label shown to the user.
   * @param {*} title Title displayed or stored by this operation.
   * @param {boolean=} disabled Value used by this operation.
   * @return {string} Resulting text.
   */
  const button = (target, label, title, disabled = false) =>
    renderTemplate('smallButton', {
      target: target,
      title: title,
      disabled: disabled ? 'disabled' : '',
      label: label,
    });
  const pages = composeMarkup(visiblePages(page, pageCount).map(number =>
    number === '…'
      ? renderTemplate('paginationEllipsis')
      : renderTemplate('smallButton2', {
        number: number === page ? ' current' : '',
        number2: number,
        pageLabel: t("home.pagination.pageLabel", {page: number}),
        number3: number === page ? 'aria-current="page"' : '',
        number4: number,
      })));
  return renderTemplate('collectionPagination', {
    rangeSummary: t("home.pagination.rangeSummary", {from, to, total, label}),
    button: button(1, chevronsLeftIcon, t('home.pagination.first'), page === 1),
    button2: button(Math.max(1, page - 1), chevronLeftIcon, t('home.pagination.previous'), page === 1),
    pages: pages,
    button3: button(Math.min(pageCount, page + 1), chevronRightIcon, t('home.pagination.next'), page === pageCount),
    button4: button(pageCount, chevronsRightIcon, t('home.pagination.last'), page === pageCount),
    pageSizeLabel: pageSizeLabel,
    pageSizeLabel2: pageSizeLabel,
    pAGESIZEOPTIONS: composeMarkup(PAGE_SIZE_OPTIONS.map(option =>
      renderTemplate(
        'pagerHtmlOption',
        {
          option: option,
          selected: option === selectedSize ? 'selected' : '',
          option2: option,
        }
      ))),
  });
}

/**
 * Collection overview uses delegated root events; render does not bind
 * listeners.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {!Object} Structured result for the caller.
 */
export function createHomeView({
  state,
  selectors,
  shell,
  navigate,
  refresh,
  showModal,
  closeModal,
  confirm: confirmModal
}) {
  const {bottles, coverPhoto, distilleryNames} = selectors;
  let activeList = [];
  let activePageSize = 1;
  let filtersExpanded = false;
  /**
   * Derives the saved views result from the supplied values.
   * @return {*} Result computed from the supplied inputs.
   */
  const savedViews = () => state.collection?.settings?.savedViews || [];
  let flavorDraft = null;
  let columnPickerOpen = false;
  const columnSelection = loadTableColumns();
  /**
   * Updates page url in the current state.
   *
   * @param {boolean=} replace Value used by this operation.
   */
  function updatePageUrl(replace = false) {
    const url = homePageUrl(state.pageNumber, state.overviewMode);
    if (location.pathname + location.search !== url) {
      history[replace ? 'replaceState' : 'pushState']({whiskyRoute: true}, '', url);
    }
  }

  /**
   * Updates page in the current state.
   *
   * @param {*} target Target of the operation.
   */
  function changePage(target) {
    const next = paginate(activeList, target, activePageSize).page;
    if (next === state.pageNumber) return;
    state.pageNumber = next;
    updatePageUrl();
    home();
    document.querySelector('.collection-heading')?.scrollIntoView({
      block: 'start', behavior: 'auto',
    });
  }

  /**
   * Derives the capture view result from the supplied values.
   * @return {!Array<*>} Resulting entries in their output order.
   */
  function captureView() {
    return {
      filters: {
        search: state.search,
        status: state.status,
        completion: state.completion,
        distillery: state.distillery,
        rating: state.rating,
        volumeType: state.volumeType,
        flavorCriteria: normalizeFlavorCriteria(state.flavorCriteria || []),
        profileMissing: !!state.profileMissing,
        profilePresent: !!state.profilePresent,
      },
      display: {
        sort: state.sort, view: state.view, mode: state.overviewMode,
        columns: {
          bottlings: [...columnSelection.bottlings],
          bottles: [...columnSelection.bottles],
        },
      },
    };
  }

  /**
   * Persists views to its backing store.
   *
   * @param {*} views Value used by this operation.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function storeViews(views) {
    try {
      await request('/api/settings/saved-views', {method: 'PUT', body: JSON.stringify({views})});
      await refresh('collection');
      home();
    } catch (error) {toast(error.message, true);}
  }

  /**
   * Performs the open save view lifecycle action.
   */
  function openSaveView() {
    showModal(
      t('collection.saved.saveTitle'),
      renderTemplate('collectionSaveViewDialog', {
        name: t('collection.saved.name'),
        closeModalButton: actionButton({
          label: t('common.actions.cancel'),
          action: 'close-modal',
        }),
        collectionViewSaveConfirmButton: actionButton({
          label: t('common.actions.save'),
          action: 'collection-view-save-confirm',
          variant: 'primary',
        }),
      }),
      false
    );
  }

  /**
   * Persists current view to its backing store.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function saveCurrentView() {
    const field = document.querySelector('[data-view-name]');
    if (!field?.reportValidity() || !field.value.trim()) return;
    const id = globalThis.crypto?.randomUUID?.() || `view-${Date.now()}`;
    const views = [...savedViews(), {
      id, name: field.value.trim(), ...captureView(),
    }];
    if (views.length > 40) return toast(t('collection.saved.limit'), true);
    closeModal();
    state.activeSavedViewId = id;
    await storeViews(views);
  }

  /**
   * Updates current view in the current state.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function updateCurrentView() {
    const id = state.activeSavedViewId;
    if (!savedViews().some(view => view.id === id)) return;
    await storeViews(savedViews().map(view => view.id === id ? {...view, ...captureView()} : view));
  }

  /**
   * Builds the localized rename current view text for the current language.
   */
  function renameCurrentView() {
    const item = savedViews().find(view => view.id === state.activeSavedViewId);
    if (!item) return;
    showModal(
      t('collection.saved.rename'),
      renderTemplate('collectionSaveViewDialog2', {
        name: item.name,
        closeModalButton: actionButton({
          label: t('common.actions.cancel'),
          action: 'close-modal',
        }),
        collectionViewRenameConfirmButton: actionButton({
          label: t('common.actions.save'),
          action: 'collection-view-rename-confirm',
          variant: 'primary',
        }),
      }),
      false
    );
  }

  /**
   * Locates the DOM elements used by confirm rename view.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function confirmRenameView() {
    const name = document.querySelector('[data-view-name]');
    if (!name?.reportValidity() || !name.value.trim()) return;
    const id = state.activeSavedViewId;
    if (!savedViews().some(view => view.id === id)) return;
    closeModal();
    await storeViews(savedViews().map(view => view.id === id ? {...view, name: name.value.trim()} : view));
  }

  /**
   * Removes or resets current view.
   * @return {!Promise<*>} Promise for the asynchronous operation.
   */
  async function deleteCurrentView() {
    const id = state.activeSavedViewId;
    const item = savedViews().find(view => view.id === id);
    if (!item || !(await confirmModal(
      t('collection.saved.delete'),
      t('collection.saved.deleteConfirm', {name: item.name}),
      t('common.actions.delete')
    ))) return;
    state.activeSavedViewId = null;
    await storeViews(savedViews().filter(view => view.id !== id));
  }

  /**
   * Updates saved view in the current state.
   *
   * @param {*} id Identifier of the affected record.
   */
  function applySavedView(id) {
    if (!id) {resetStandardView(); return;}
    const item = savedViews().find(view => view.id === id);
    if (!item) {state.activeSavedViewId = null; home(); return;}
    for (const field of ['search', 'status', 'completion', 'distillery',
      'rating', 'volumeType']) state[field] = item.filters[field];
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

  /**
   * Transforms the entries used by plan from selection.
   */
  function planFromSelection() {
    state.flightCandidateIds = [...new Set(activeList.map(item => item.bottling.id))];
    navigate('tastings-home');
  }

  /**
   * Derives the profile status result from the supplied values.
   * @return {*} Result computed from the supplied inputs.
   */
  function profileStatus() {
    return state.profileMissing ? 'without' : state.profilePresent ? 'with' : 'all';
  }

  /**
   * Derives the new flavor draft result from the supplied values.
   * @return {!Array<*>} Resulting entries in their output order.
   */
  function newFlavorDraft() {
    return {
      status: profileStatus(),
      criteria: normalizeFlavorCriteria(state.flavorCriteria || []),
    };
  }

  /**
   * Selects and transforms the flavor editor content records.
   * @return {string} Resulting text.
   */
  function flavorEditorContent() {
    const draft = flavorDraft || newFlavorDraft();
    const available = FLAVOR_AXES.filter(axis => !draft.criteria.some(item => item.axis === axis));
    const statusOptions = [
      ['all', 'collection.flavor.any'],
      ['with', 'collection.flavor.with'],
      ['without', 'collection.flavor.without'],
    ];
    /**
     * Calculates options from the inputs.
     *
     * @param {*} selected Currently selected item or identifier.
     * @return {string} Resulting text.
     */
    const scoreOptions = (selected) => composeMarkup(Array.from(
      {length: 11},
      (_, i) => renderTemplate('scoreOptionsOption', {
        i: i,
        selected: selected === i ? 'selected' : '',
        i2: i,
      })
    ));
    return renderTemplate('collectionFlavorStatus', {
      missing: t('collection.flavor.missing'),
      statusOptions: composeMarkup(statusOptions.map((
        [value, label]) =>
        renderTemplate('flavorEditorContentLabel', {
          value: value,
          checked: draft.status === value ? 'checked' : '',
          t: t(label),
        }))),
      hidden: draft.status === 'without' ? 'hidden' : '',
      criteria: composeMarkup(draft.criteria.map(item => renderTemplate(
        'collectionFlavorRow',
        {
          t: t(`flavor.axis.${item.axis}`),
          axis: item.axis,
          remove: t('collection.flavor.remove', {name: t(`flavor.axis.${item.axis}`)}),
          closeIcon: closeIcon,
          min: t('collection.flavor.min'),
          axis2: item.axis,
          scoreOptions: scoreOptions(item.min),
          max: t('collection.flavor.max'),
          axis3: item.axis,
          scoreOptions2: scoreOptions(item.max),
        }
      ))),
      collectionAddFlavorAxis: available.length ?
        renderTemplate('collectionAddFlavorAxis', {
          axis: t('collection.flavor.axis'),
          selectAxis: t('collection.flavor.selectAxis'),
          available: composeMarkup(available.map(axis => renderTemplate(
            'flavorEditorContentOption',
            {
              axis: axis,
              t: t(`flavor.axis.${axis}`),
            }
          ))),
          add: t('collection.flavor.add'),
        }) : '',
      collectionFlavorResetButton: actionButton({
        label: t('analytics.filters.reset'),
        action: 'collection-flavor-reset',
      }),
      collectionFlavorApplyButton: actionButton({
        label: t('collection.flavor.apply'),
        action: 'collection-flavor-apply',
        variant: 'primary',
      }),
    });
  }

  /**
   * Produces the flavor editor html text used by the caller.
   * @return {string} Resulting text.
   */
  function flavorEditorHtml() {
    return renderTemplate('collectionFlavorEditor', {flavorEditorContent: flavorEditorContent(), });
  }

  /**
   * Updates the DOM elements managed by redraw flavor editor.
   *
   * @param {*=} focusSelector Value used by this operation.
   */
  function redrawFlavorEditor(focusSelector = null) {
    const editor = document.querySelector('[data-collection-flavor-editor]');
    if (!editor) return;
    const scrollTop = editor.closest('.collection-flavor-popover, .dialog')?.scrollTop || 0;
    replaceContent(editor, flavorEditorContent());
    const scroller = editor.closest('.collection-flavor-popover, .dialog');
    if (scroller) scroller.scrollTop = scrollTop;
    if (focusSelector) editor.querySelector(focusSelector)?.focus();
  }

  /**
   * Performs the open flavor filter lifecycle action.
   */
  function openFlavorFilter() {
    flavorDraft = newFlavorDraft();
    showModal(t('collection.flavor.title'), flavorEditorHtml(), false);
  }

  /**
   * Locates the DOM elements used by add flavor criterion.
   */
  function addFlavorCriterion() {
    const axis = document.querySelector('[data-collection-flavor-editor] #collection-add-flavor-axis')?.value;
    if (!flavorDraft || !FLAVOR_AXES.includes(axis) || flavorDraft.criteria.some(item => item.axis === axis)) return;
    flavorDraft.criteria.push({axis, min: 0, max: 10});
    if (flavorDraft.status === 'without') flavorDraft.status = 'with';
    redrawFlavorEditor('[data-act="collection-flavor-remove"][data-axis="' + axis + '"]');
  }

  /**
   * Removes or resets flavor criterion.
   *
   * @param {*} axis Value used by this operation.
   */
  function removeFlavorCriterion(axis) {
    if (!flavorDraft) return;
    flavorDraft.criteria = flavorDraft.criteria.filter(item => item.axis !== axis);
    redrawFlavorEditor('#collection-add-flavor-axis');
  }

  /**
   * Updates flavor criterion in the current state.
   *
   * @param {*} input Input element or value to inspect.
   */
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

  /**
   * Updates flavor status in the current state.
   *
   * @param {*} value Value to process.
   */
  function changeFlavorStatus(value) {
    if (!flavorDraft || !['all', 'with', 'without'].includes(value)) return;
    flavorDraft.status = value;
    redrawFlavorEditor(`[data-flavor-profile-status][value="${value}"]`);
  }

  /**
   * Removes or resets flavor draft.
   */
  function resetFlavorDraft() {
    flavorDraft = {status: 'all', criteria: []};
    redrawFlavorEditor('[data-flavor-profile-status][value="all"]');
  }

  /**
   * Updates flavor draft in the current state.
   */
  function applyFlavorDraft() {
    if (!flavorDraft) return;
    state.profileMissing = flavorDraft.status === 'without';
    state.profilePresent = flavorDraft.status === 'with';
    state.flavorCriteria = state.profileMissing ? [] : normalizeFlavorCriteria(flavorDraft.criteria);
    flavorDraft = null;
    state.pageNumber = 1;
    if (document.querySelector('#modal-root [data-collection-flavor-editor]'))
      closeModal();
    home();
  }

  /**
   * Removes or resets standard view.
   */
  function resetStandardView() {
    for (const field of ['status', 'completion', 'distillery', 'rating',
      'volumeType']) state[field] = 'all';
    state.search = ''; state.sort = 'name'; state.flavorCriteria = [];
    state.profileMissing = false; state.profilePresent = false;
    state.activeSavedViewId = null; state.pageNumber = 1;
    home();
  }

  /**
   * Serializes active view changed data to JSON.
   * @return {boolean} Whether the operation matched or succeeded.
   */
  function activeViewChanged() {
    const saved = savedViews().find(item => item.id === state.activeSavedViewId);
    if (!saved) return false;
    const current = captureView();
    return JSON.stringify(current.filters) !==
      JSON.stringify({
        ...saved.filters, profilePresent: !!saved.filters.profilePresent,
      }) ||
      JSON.stringify(current.display) !== JSON.stringify(saved.display);
  }

  /**
   * Transforms the entries used by saved views menu html.
   * @return {string} Resulting text.
   */
  function savedViewsMenuHtml() {
    const current = savedViews().find(item => item.id === state.activeSavedViewId);
    const dirty = current && activeViewChanged();
    const label = current?.name || t('collection.saved.standard');
    const bookmark = renderTemplate('bookmarkSvg');
    return renderTemplate('collectionSavedViews', {
      title: t('collection.saved.title'),
      label: label,
      bookmark: bookmark,
      view: t('collection.saved.view'),
      label2: label,
      collectionSavedDirty: dirty ? renderTemplate('collectionSavedDirty', {changed: t('collection.saved.changed'), }) : '',
      chevronDownIcon: chevronDownIcon('collection-menu-chevron'),
      title2: t('collection.saved.title'),
      content: !current ? ' is-active' : '',
      standard: t('collection.saved.standard'),
      savedViews: composeMarkup(savedViews().map(view =>
        renderTemplate('collectionSavedItem', {
          id: current?.id === view.id ? ' is-active' : '',
          id2: view.id,
          name: view.name,
        }))),
      save: t('collection.saved.save'),
      collectionViewUpdate: current ?
        renderTemplate('collectionViewUpdate', {
          update: t('collection.saved.update'),
          rename: t('collection.saved.rename'),
          delete: t('collection.saved.delete'),
        }) : '',
    });
  }

  /**
   * Handles click for home.
   *
   * @param {*} button Button used by this operation.
   */
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
      if (![
        'status',
        'completion',
        'distillery',
        'rating',
        'volumeType',
        'flavor',
        'profileMissing',
        'profilePresent',
      ].includes(key)) return;
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

  /**
   * Handles change for home.
   *
   * @param {*} input Input to process.
   */
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
        'filter-status': 'status',
        'filter-completion': 'completion',
        'filter-sort': 'sort',
        'filter-distillery': 'distillery',
        'filter-volume-type': 'volumeType',
        'filter-rating': 'rating',
      }[input.id];
      if (!field) return;
      state[field] = input.value;
    }
    state.pageNumber = 1;
    updatePageUrl(true);
    home();
    if (input.id === 'pagination-size') document.querySelector('.collection-heading')?.scrollIntoView({
      block: 'start',
      behavior: 'auto',
    });
  }

  /**
   * Handles the input interaction.
   *
   * @param {*} input Input element or value to inspect.
   */
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

  /**
   * Selects and transforms the home records.
   */
  function home() {
    const {collection, physical, total, open, closed, establishedYear, mode,
      selectedColumns, label, distilleries, distillery, list, pageSize,
      pageData} = createCollectionViewModel(state, selectors, columnSelection);
    state.distillery = distillery;
    if (state.pageNumber !== pageData.page) {
      state.pageNumber = pageData.page;
      history.replaceState({whiskyRoute: true}, '', homePageUrl(pageData.page, mode));
    }
    const visibleList = pageData.items;
    activeList = list;
    activePageSize = pageSize;
    const cards = composeMarkup(visibleList.map(({bottling, bottle}) => {
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
      return renderTemplate('open', {
        id: bottling.id,
        bottle: bottle ?
          ` data-bottle-id="${escapeHtml(bottle.id)}" aria-label="${escapeHtml(t(
            "home.image.bottleAccessibleName",
            {
              name: bottling.name,
              number: bottle.inventoryNumber || t("home.inventory.withoutInventoryNumber"),
            }
          ))}"` : '',
        img: photo ?
          renderTemplate('img', {
            imageUrl: imageUrl(photo),
            bottleAlt: t("home.image.bottleAlt", {name: bottling.name}),
          }) :
          renderTemplate('imagePlaceholder'),
        collectionCardRating: collectionCardRating(bottling, bottle?.id),
        cardKicker: origin ? renderTemplate('cardKicker', {origin: origin, }) : '',
        name: bottling.name,
        cardBottleMeta: bottleInfo ? renderTemplate('cardBottleMeta', {bottleInfo: bottleInfo, }) : '',
        cardFacts: facts.length ? renderTemplate('cardFacts', {facts: facts.join(' · '), }) : '',
        badge: bottle ? renderTemplate('badge3', {
          status: bottle.status || '',
          statusText: statusText(bottle.status),
          badge: bottle.volumeType === 'sample' ? renderTemplate('badge4') : '',
        }) :
          inventoryBadges(physicalBottles),
        badge2: bottling.completionStatus === 'incomplete' ? renderTemplate('badge5') : '',
      });
    }));
    const rows = composeMarkup(visibleList.map(({bottling, bottle}) => {
      const entry = {bottling, bottle};
      const attrs =
        `class="clickable" tabindex="0" data-act="open" data-id="${escapeHtml(bottling.id)}"${bottle ? ` data-bottle-id="${escapeHtml(bottle.id)}" aria-label="${escapeHtml(t(
          'home.image.bottleAccessibleName',
          {
            name: bottling.name,
            number: bottle.inventoryNumber || t('home.inventory.withoutInventoryNumber'),
          }
        ))}"` : ''}`;
      const cells = composeMarkup(selectedColumns.map(column =>
        collectionTableCell(column.id, entry, bottle ? [bottle] : bottles(bottling.id), distilleryNames)));
      return renderTemplate('tr', {
        attrs: attrs,
        cells: cells,
      });
    }));
    const tableHead = composeMarkup(selectedColumns.map(column => {
      const active = state.sort === column.asc || state.sort === column.desc;
      const descending = state.sort === column.desc;
      const title = t(column.label);
      return renderTemplate('th', {
        active: active ? ` aria-sort="${descending ? 'descending' : 'ascending'}"` : '',
        active2: active ? ' is-active' : '',
        id: column.id,
        sortBy: t('home.table.sortBy', {name: title}),
        title: title,
        active3: active ? (descending ? arrowDownIcon : arrowUpIcon) : arrowsUpDownIcon,
      });
    }));
    const columnPicker =
      renderTemplate('collectionTableTools', {
        columnPickerOpen: columnPickerOpen ? ' open' : '',
        tABLECOLUMNS: composeMarkup(TABLE_COLUMNS[mode].map(column =>
          renderTemplate('collectionTableColumnChoice', {
            id: column.id,
            checked: columnSelection[mode].includes(column.id) ? 'checked' : '',
            t: t(column.label),
          }))),
        collectionColumnsDefaultButton: actionButton({
          label: t('home.table.resetColumns'),
          action: 'collection-columns-default',
          size: 'small',
          className: 'collection-table-columns-reset',
        }),
      });
    // The original description stays verbatim. CSS keeps the whole copy on
    // one line on desktop and permits natural wrapping on small screens.
    const heroCopy = escapeHtml(t('home.hero.description'));
    shell(renderTemplate('collectionHero', {
      heroCopy: heroCopy,
      newBottlingIcon: newBottlingIcon,
      inventoryScanIcon: inventoryScanIcon,
      establishedYear: establishedYear ? ` · EST. ${establishedYear}` : '',
      pageHeader: pageHeader({
        title: t("home.collection.title"),
        eyebrow: t("home.hero.archiveEyebrow"),
        intro: t("home.hero.everyBottlingHasStory"),
        className: 'collection-heading',
        copyClass: '',
        actions:
          renderTemplate('collectionModeToggle', {
            mode: mode === 'bottlings' ? ' active' : '',
            mode2: mode === 'bottlings',
            length: collection.bottlings.length,
            mode3: mode === 'bottles' ? ' active' : '',
            mode4: mode === 'bottles',
            total: total,
          }),
      }),
      content: composeMarkup([
        [t("analytics.inventory.bottlings"), collection.bottlings.length],
        [t("home.inventory.totalStock"), total],
        [t("home.status.closed"), closed],
        [t("analytics.inventory.openedStatus"), open],
      ].map(([label, value]) => contentPanel({
        className: 'stat',
        content: renderTemplate('contentSpan', {
          label: label,
          value: value,
        }),
      }))),
      content2: (() => {
        const distillery = distilleries.find(item => item.id === state.distillery);
        const rating = state.rating === 'unrated' ? t('home.filters.unrated') :
          ['1', '2', '3', '4', '5'].includes(state.rating) ? t(
            'home.filters.ratingRange',
            {
              from: state.rating === '1' ? '0' : `${(Number(state.rating) - 1) * 20},1`,
              to: Number(state.rating) * 20,
            }
          ) : null;
        const active = [
          [
            'status',
            state.status !== 'all' ? statusText(state.status) : null,
            t('forms.bottle.status'),
          ],
          [
            'completion',
            state.completion === 'complete' ? t('detail.status.complete') :
              state.completion === 'incomplete' ? t('detail.status.incomplete') : null,
            t('home.filters.completeness'),
          ],
          ['distillery', distillery?.name, t('home.filters.filterDistillery')],
          ['rating', rating, t('home.filters.filterRating')],
          [
            'volumeType',
            state.volumeType === 'sample' ?
              t('analytics.inventory.samples') : state.volumeType === 'standard' ? t('home.inventory.standardBottles') : null,
            t('home.filters.filterBottleType'),
          ],
          ...((state.flavorCriteria || []).map(item => [
            `flavor-axis:${item.axis}`,
            `${t(`flavor.axis.${item.axis}`)} ${item.min}–${item.max}`,
            t('collection.flavor.title'),
          ])),
          [
            'profileMissing',
            state.profileMissing ? t('collection.flavor.without') : null,
            t('collection.flavor.title'),
          ],
          [
            'profilePresent',
            state.profilePresent ? t('collection.flavor.with') : null,
            t('collection.flavor.title'),
          ],
        ].filter(([, value]) => value);
        return renderTemplate('toolbar', {
          filtersExpanded: filtersExpanded,
          filters: t('home.filters.filters'),
          filters2: t('home.filters.filters'),
          savedViewsMenuHtml: savedViewsMenuHtml(),
          search: state.search,
          content: composeMarkup([
            ['name', 'home.sort.nameAscending'],
            ['nameDesc', 'home.sort.nameDescending'],
            ['inventoryAsc', 'home.sort.inventoryAscending'],
            ['inventoryDesc', 'home.sort.inventoryDescending'],
            ['distillery', 'home.sort.distilleryAscending'],
            ['distilleryDesc', 'home.sort.distilleryDescending'],
            [
              'priceAsc',
              mode === 'bottles' ? 'home.sort.priceAscending' : 'home.sort.averagePriceAscending',
            ],
            [
              'priceDesc',
              mode === 'bottles' ? 'home.sort.priceDescending' : 'home.sort.averagePriceDescending',
            ],
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
          ].map(([value, key]) => renderTemplate('homeOption', {
            value: value,
            selected: state.sort === value ? 'selected' : '',
            t: t(key),
          }))),
          entries: composeMarkup(Object.entries(bottleStatusLabels).map(([k]) =>
            renderTemplate('homeOption2', {
              k: k,
              selected: state.status === k ? 'selected' : '',
              statusText: statusText(k),
            }))),
          selected: state.completion === 'incomplete' ? 'selected' : '',
          selected2: state.completion === 'complete' ? 'selected' : '',
          filtersExpanded2: filtersExpanded,
          view: state.view === 'cards' ? t('home.view.table') : t('home.view.cards'),
          view2: state.view === 'cards' ? t('home.view.table') : t('home.view.cards'),
          view3: state.view === 'cards' ? collectionTableIcon : collectionCardsIcon,
          view4: state.view === 'cards' ? t('home.view.table') : t('home.view.cards'),
          distilleries: composeMarkup(distilleries.map(item =>
            renderTemplate('homeOption3', {
              id: item.id,
              selected: state.distillery === item.id ? 'selected' : '',
              name: item.name,
            }))),
          selected3: state.rating === 'all' ? 'selected' : '',
          content2: composeMarkup([1, 2, 3, 4, 5].map(level =>
            renderTemplate('homeOption4', {
              level: level,
              selected: state.rating === String(level) ? 'selected' : '',
              ratingRange: t(
                'home.filters.ratingRange',
                {
                  from: level === 1 ? '0' : `${(level - 1) * 20},1`,
                  to: level * 20,
                }
              ),
            }))),
          selected4: state.rating === 'unrated' ? 'selected' : '',
          selected5: state.volumeType === 'all' ? 'selected' : '',
          selected6: state.volumeType === 'standard' ? 'selected' : '',
          selected7: state.volumeType === 'sample' ? 'selected' : '',
          filter: t('collection.flavor.filter'),
          length: (state.flavorCriteria || []).length ? ` (${state.flavorCriteria.length})` : '',
          profileMissing: state.profileMissing || state.profilePresent ? ' •' : '',
          chevronDownIcon: chevronDownIcon('collection-flavor-chevron'),
          title: t('collection.flavor.title'),
          filter2: t('collection.flavor.filter'),
          close: t('common.actions.close'),
          closeIcon: closeIcon,
          flavorEditorHtml: flavorEditorHtml(),
          collectionFlavorOpenButton: actionButton({
            label: t('collection.flavor.filter') + ((state.flavorCriteria || []).length ? ` (${state.flavorCriteria.length})` : '') +
              (state.profileMissing || state.profilePresent ? ' •' : ''),
            action: 'collection-flavor-open',
            className: 'collection-flavor-mobile-trigger',
          }),
          collectionFilterActive: active.length ? renderTemplate(
            'collectionFilterActive',
            {
              active: composeMarkup(active.map(([key, value,
                label]) =>
                renderTemplate('collectionFilterChip', {
                  startsWith: key.startsWith('flavor-axis:') ?
                    `data-reset-collection-flavor-axis="${escapeHtml(key.slice(12))}"` :
                    `data-reset-collection-filter="${key}"`,
                  removeFilter: t('home.filters.removeFilter', {name: `${label}: ${value}`, }),
                  value: value,
                  closeIcon: closeIcon,
                }))),
            }
          ) : '',
        });
      })(),
      count: t('collection.results.count', {count: list.length, label}),
      length: list.length ? '' : 'disabled',
      flightPlanIcon: flightPlanIcon,
      planFlight: t('collection.results.planFlight'),
      view: state.view === 'table' && list.length ? columnPicker : '',
      paginationTopline: pageData.pageCount > 1 ? renderTemplate(
        'paginationTopline',
        {
          rangeSummary: t("home.pagination.rangeSummary", {from: pageData.from, to: pageData.to, total: pageData.total, label}),
          max: Math.max(1, pageData.page - 1),
          disabled: pageData.page === 1 ? 'disabled' : '',
          chevronLeftIcon: chevronLeftIcon,
          pageOf: t("home.pagination.pageOf", {page: pageData.page, total: pageData.pageCount}),
          min: Math.min(pageData.pageCount, pageData.page + 1),
          disabled2: pageData.page === pageData.pageCount ? 'disabled' : '',
          chevronRightIcon: chevronRightIcon,
        }
      ) : '',
      length2: list.length ? (state.view === 'cards' ?
        renderTemplate('grid', {cards: cards, }) :
        renderTemplate('tableWrap', {
          tableHead: tableHead,
          rows: rows,
        })) : emptyState({
          variant: 'collection',
          title: list.length === 0 && mode === 'bottles' && !physical.length && collection.bottlings.length ?
            t("home.empty.noPhysicalBottles") : collection.bottlings.length ? t("home.empty.noMatchingEntries") : t("home.empty.noBottles"),
          description: mode === 'bottles' && !physical.length && collection.bottlings.length ?
            t("home.empty.addBottleToExistingHint") : collection.bottlings.length ? t("home.filters.changeFiltersHint") : t("home.empty.getStartedHint"),
          actions: collection.bottlings.length ? '' :
            actionButton({
              label: t("collection.actions.newBottle"),
              action: 'new',
              variant: 'primary',
            }),
        }),
      total: pageData.total ? pagerHtml(pageData, state.pageSize, mode) : '',
    }));

    // DOM reconciliation preserves form nodes to avoid scroll/focus jumps.
    // Native SELECT/INPUT properties can retain a stale user-edited value
    // even after their option attributes were reconciled (e.g. a saved
    // view restored "all" after an earlier "open" selection).
    for (const [id, value] of Object.entries({
      'search': state.search,
      'filter-sort': state.sort,
      'filter-status': state.status,
      'filter-completion': state.completion,
      'filter-distillery': state.distillery,
      'filter-rating': state.rating,
      'filter-volume-type': state.volumeType,
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
      if (flavorPicker.open) {
        flavorDraft = newFlavorDraft(); redrawFlavorEditor();
      }
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
  home.closeFlavorFilter = () => {
    const picker = document.querySelector('[data-collection-flavor-picker]');
    if (picker) picker.open = false; flavorDraft = null;
  };
  home.changeFlavorStatus = changeFlavorStatus;
  home.applySavedView = applySavedView;
  home.removeFlavorCriterion = removeFlavorCriterion;
  home.planFromSelection = planFromSelection;
  return home;
}
