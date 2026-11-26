

import {composeMarkup} from '../ui/render-plan.js';

import {actionButton} from '../ui/buttons.js';

import {request} from '../api.js';
import {toast} from '../ui/notifications.js';

import {normalizeFlavorCriteria}
  from '../../../shared/collection-saved-views.js';
import {t} from '../i18n/index.js';
import {loadTemplates} from '../ui/templates.js';
import {chevronDownIcon} from '../ui/action-icons.js';

import {saveTableColumns, normalizeTableColumns} from '../domain/collection-table-columns.js';

const renderTemplate = await loadTemplates('collection/home.html');

/**
 * Manages collection view presets, persistence, and preset selection.
 * @param {!Object} options Controller dependencies.
 * @return {!Object} Public controller actions and presentation.
 */
export function createSavedViewsController({state, columnSelection, refresh, home, showModal, closeModal, confirmModal, updatePageUrl}) {
  /**
   * Reads the currently stored collection views from settings.
   * @return {import('../../../shared/collection-saved-views.js').SavedView[]} Current presets, or an empty list before collection data is loaded.
   */
  const savedViews = () => state.collection?.settings?.savedViews || [];

  /**
   * Captures the current collection filters, sorting and display configuration for saving.
   * @return {import('../../../shared/collection-saved-views.js').SavedViewConfig} Current filter and display configuration, without a preset name or ID.
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
   * @param {import('../../../shared/collection-saved-views.js').SavedView[]} views Updated saved-view records to persist in collection settings.
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
    const field = /** @type {HTMLInputElement|null} */ (document.querySelector('[data-view-name]'));
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
    const name = /** @type {HTMLInputElement|null} */ (document.querySelector('[data-view-name]'));
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
   * Prepares saved collection views and actions reflecting the current selection and changes.
   * @return {!import('../ui/render-plan.js').RenderPlan} Saved collection views and actions reflecting the current selection and changes.
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
      activeViewLabel: label,
      collectionSavedDirty: dirty ? renderTemplate('collectionSavedDirty', {changed: t('collection.saved.changed'), }) : '',
      chevronDownIcon: chevronDownIcon('collection-menu-chevron'),
      ariaLabel: t('collection.saved.title'),
      content: !current ? ' is-active' : '',
      standard: t('collection.saved.standard'),
      savedViews: composeMarkup(savedViews().map(view =>
        renderTemplate('collectionSavedItem', {
          id: current?.id === view.id ? ' is-active' : '',
          savedViewId: view.id,
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

  return {openSaveView, saveCurrentView, updateCurrentView, renameCurrentView, confirmRenameView, deleteCurrentView, applySavedView, savedViewsMenuHtml};
}
