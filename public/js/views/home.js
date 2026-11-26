import {createSavedViewsController} from './collection-saved-views-controller.js';
import {createCollectionFlavorController} from './collection-flavor-controller.js';
import {statusText, inventoryBadges, collectionTableCell, collectionCardRating, pagerHtml} from './collection-presentation.js';
import {createCollectionViewModel, createCollectionEntryModels, createActiveCollectionFilters} from './models/home.js';
import {composeMarkup} from '../ui/render-plan.js';

import {actionButton} from '../ui/buttons.js';
import {pageHeader} from '../ui/headers.js';

import {FLAVOR_AXES} from '../../../shared/flavor-profile.js';

import {t} from '../i18n/index.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates('collection/home.html');
import {newBottlingIcon, inventoryScanIcon, chevronDownIcon, chevronLeftIcon, chevronRightIcon, arrowUpIcon, arrowDownIcon, arrowsUpDownIcon, closeIcon, collectionTableIcon, collectionCardsIcon, flightPlanIcon} from '../ui/action-icons.js';
import {emptyState, panel as contentPanel} from '../ui/content.js';
import {imageUrl} from '../ui/format.js';
import {bottleStatusLabels} from '../domain/labels.js';

import {paginate, homePageUrl} from '../domain/pagination.js';
import {savePageSizePreference} from '../domain/page-size-preference.js';

import {
  TABLE_COLUMNS, loadTableColumns, saveTableColumns, sortForColumn,
  normalizeTableColumns, DEFAULT_TABLE_COLUMNS
}
  from '../domain/collection-table-columns.js';

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
  const {bottles, coverPhoto} = selectors;
  let activeList = [];
  let activePageSize = 1;
  let filtersExpanded = false;
  let columnPickerOpen = false;
  const columnSelection = loadTableColumns();
  const {openSaveView, saveCurrentView, updateCurrentView, renameCurrentView, confirmRenameView, deleteCurrentView, applySavedView, savedViewsMenuHtml} = createSavedViewsController({state, columnSelection, refresh, home, showModal, closeModal, confirmModal, updatePageUrl});
  const {flavorEditorHtml, openFlavorFilter, addFlavorCriterion, removeFlavorCriterion, changeFlavorCriterion, changeFlavorStatus, resetFlavorDraft, applyFlavorDraft, toggleFlavorPicker, closeFlavorFilter} = createCollectionFlavorController({state, showModal, closeModal, home});

  /**
   * Updates page url in the current state.
   *
   * @param {boolean=} replace Replace the current history entry rather than creating a new one.
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
   * Transforms the entries used by plan from selection.
   */
  function planFromSelection() {
    state.flightCandidateIds = [...new Set(activeList.map(item => item.bottling.id))];
    navigate('tastings-home');
  }

  /**
   * Handles click for home.
   *
   * @param {*} button Collection action control carrying its data-act and record identifiers.
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
    const visibleList = createCollectionEntryModels(pageData.items, selectors);
    activeList = list;
    activePageSize = pageSize;
    const cards = composeMarkup(visibleList.map(({bottling, bottle, physicalBottles, origin, facts, bottleInfo, bottleAccessibleName, photo}) => {
      return renderTemplate('open', {
        id: bottling.id,
        dataBottleIdAttributes: bottle ? {'data-bottle-id': bottle.id, 'aria-label': bottleAccessibleName} : {},
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
        cardFacts: facts ? renderTemplate('cardFacts', {facts}) : '',
        badge: bottle ? renderTemplate('badge3', {
          status: bottle.status || '',
          statusText: statusText(bottle.status),
          badge: bottle.volumeType === 'sample' ? renderTemplate('badge4') : '',
        }) :
          inventoryBadges(physicalBottles),
        incompleteBadge: bottling.completionStatus === 'incomplete' ? renderTemplate('badge5') : '',
      });
    }));
    const rows = composeMarkup(visibleList.map(({bottling, bottle, table, bottleAccessibleName}) => {
      const attrs = {
        class: 'clickable', tabindex: '0', 'data-act': 'open', 'data-id': bottling.id,
        'data-bottle-id': bottle?.id,
        'aria-label': bottleAccessibleName,
      };
      const cells = composeMarkup(selectedColumns.map(column =>
        collectionTableCell(column.id, table)));
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
        ariaSortAttributes: active ? {"aria-sort": descending ? 'descending' : 'ascending'} : {},
        sortClass: active ? ' is-active' : '',
        id: column.id,
        sortBy: t('home.table.sortBy', {name: title}),
        title: title,
        sortDirectionIcon: active ? (descending ? arrowDownIcon : arrowUpIcon) : arrowsUpDownIcon,
      });
    }));
    const columnPicker =
      renderTemplate('collectionTableTools', {
        openAttributes: columnPickerOpen ? {"open": true} : {},
        columnChoices: composeMarkup(TABLE_COLUMNS[mode].map(column =>
          renderTemplate('collectionTableColumnChoice', {
            id: column.id,
            checkedAttributes: columnSelection[mode].includes(column.id) ? {"checked": true} : {},
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
    const heroCopy = t('home.hero.description');
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
            ariaPressed: mode === 'bottlings',
            length: collection.bottlings.length,
            bottlesModeClass: mode === 'bottles' ? ' active' : '',
            bottlesModePressed: mode === 'bottles',
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
      activeFilterSummary: (() => {
        const active = createActiveCollectionFilters(state, distilleries);
        return renderTemplate('toolbar', {
          filtersExpanded: filtersExpanded,
          filters: t('home.filters.filters'),
          filtersLabel: t('home.filters.filters'),
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
            selectedAttributes: state.sort === value ? {"selected": true} : {},
            t: t(key),
          }))),
          entries: composeMarkup(Object.entries(bottleStatusLabels).map(([k]) =>
            renderTemplate('homeOption2', {
              k: k,
              selectedAttributes: state.status === k ? {"selected": true} : {},
              statusText: statusText(k),
            }))),
          incompleteAttributes: state.completion === 'incomplete' ? {"selected": true} : {},
          completeAttributes: state.completion === 'complete' ? {"selected": true} : {},
          ariaExpanded: filtersExpanded,
          view: state.view === 'cards' ? t('home.view.table') : t('home.view.cards'),
          toggleViewTitle: state.view === 'cards' ? t('home.view.table') : t('home.view.cards'),
          toggleViewIcon: state.view === 'cards' ? collectionTableIcon : collectionCardsIcon,
          toggleViewLabel: state.view === 'cards' ? t('home.view.table') : t('home.view.cards'),
          distilleries: composeMarkup(distilleries.map(item =>
            renderTemplate('homeOption3', {
              id: item.id,
              selectedAttributes: state.distillery === item.id ? {"selected": true} : {},
              name: item.name,
            }))),
          allAttributes: state.rating === 'all' ? {"selected": true} : {},
          ratingOptions: composeMarkup([1, 2, 3, 4, 5].map(level =>
            renderTemplate('homeOption4', {
              level: level,
              selectedAttributes: state.rating === String(level) ? {"selected": true} : {},
              ratingRange: t(
                'home.filters.ratingRange',
                {
                  from: level === 1 ? '0' : `${(level - 1) * 20},1`,
                  to: level * 20,
                }
              ),
            }))),
          unratedAttributes: state.rating === 'unrated' ? {"selected": true} : {},
          allVolumesSelected: state.volumeType === 'all' ? {"selected": true} : {},
          standardAttributes: state.volumeType === 'standard' ? {"selected": true} : {},
          sampleAttributes: state.volumeType === 'sample' ? {"selected": true} : {},
          filter: t('collection.flavor.filter'),
          length: (state.flavorCriteria || []).length ? ` (${state.flavorCriteria.length})` : '',
          profileMissing: state.profileMissing || state.profilePresent ? ' •' : '',
          chevronDownIcon: chevronDownIcon('collection-flavor-chevron'),
          title: t('collection.flavor.title'),
          flavorFilterTitle: t('collection.flavor.filter'),
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
                  dataResetCollectionFlavorAxisAttributes: key.startsWith('flavor-axis:') ? {"data-reset-collection-flavor-axis": key.slice(12)} : {"data-reset-collection-filter": key},
                  removeFilter: t('home.filters.removeFilter', {name: `${label}: ${value}`, }),
                  value: value,
                  closeIcon: closeIcon,
                }))),
            }
          ) : '',
        });
      })(),
      count: t('collection.results.count', {count: list.length, label}),
      disabledAttributes: list.length ? {} : {"disabled": true},
      flightPlanIcon: flightPlanIcon,
      planFlight: t('collection.results.planFlight'),
      view: state.view === 'table' && list.length ? columnPicker : '',
      paginationTopline: pageData.pageCount > 1 ? renderTemplate(
        'paginationTopline',
        {
          rangeSummary: t("home.pagination.rangeSummary", {from: pageData.from, to: pageData.to, total: pageData.total, label}),
          max: Math.max(1, pageData.page - 1),
          disabledAttributes: pageData.page === 1 ? {"disabled": true} : {},
          chevronLeftIcon: chevronLeftIcon,
          pageOf: t("home.pagination.pageOf", {page: pageData.page, total: pageData.pageCount}),
          min: Math.min(pageData.pageCount, pageData.page + 1),
          nextDisabled: pageData.page === pageData.pageCount ? {"disabled": true} : {},
          chevronRightIcon: chevronRightIcon,
        }
      ) : '',
      resultsContent: list.length ? (state.view === 'cards' ?
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
      toggleFlavorPicker(flavorPicker.open);
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
  home.closeFlavorFilter = closeFlavorFilter;
  home.changeFlavorStatus = changeFlavorStatus;
  home.applySavedView = applySavedView;
  home.removeFlavorCriterion = removeFlavorCriterion;
  home.planFromSelection = planFromSelection;
  return home;
}

export {collectionCardRating} from './collection-presentation.js';
