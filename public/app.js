import {replaceContent} from './js/ui/dom-renderer.js';
import {t} from './js/i18n/index.js';
/**
 * Composition root: create feature controllers and connect them, then load the
 * collection.
 */
import {request, requestCachedJson} from './js/api.js';
import {initializeLanguage} from './js/i18n/index.js';
import {createState} from './js/state.js';
import {pageFromSearch, overviewModeFromSearch}
  from './js/domain/pagination.js';
import {createSelectors} from './js/domain/selectors.js';
import {parseRoute} from './js/navigation/routes.js';
import {createNavigation} from './js/navigation/controller.js';
import {createThemeController} from './js/theme/controller.js';
import {createModal} from './js/ui/modal.js';
import {createFilePreview} from './js/features/file-preview.js';
import {createPhotoViewer} from './js/ui/photo-viewer.js';
import {createPhotoEditor} from './js/features/photo-editor/controller.js';
import {createShell} from './js/ui/shell.js';
import {toast} from './js/ui/notifications.js';
import {runAction} from './js/ui/action-result.js';
import {loadResources} from './js/ui/refresh-resources.js';
import {createHomeView} from './js/views/home.js';
import {createDetailView} from './js/views/detail.js';
import {createTastingsView} from './js/views/tastings.js';
import {createSettingsView} from './js/views/settings.js';
import {helpView} from './js/views/help.js';
import {createMapView} from './js/views/map.js';
import {createAnalyticsView} from './js/views/analytics.js';
import {createWarehouseView} from './js/views/warehouse.js';
import {createBottlingForm} from './js/features/forms/bottling.js';
import {createBottleForm} from './js/features/forms/bottle.js';
import {createEditors} from './js/features/editor-controller.js';
import {createSettingsController} from './js/features/settings-controller.js';
import {createBackupController} from './js/features/backups/controller.js';
import {createCodeResolver} from './js/features/scanner/resolve-code.js';
import {createScanner} from './js/features/scanner/controller.js';
import {createWhiskybase} from './js/features/whiskybase/controller.js';
import {bindEvents} from './js/events.js';
import {createAuthController} from './js/features/auth/controller.js';
import {loadTemplates} from './js/ui/templates.js';

const renderTemplate = await loadTemplates('app.html');

await initializeLanguage();
const root = document.querySelector('#app');
const state = createState(parseRoute(location.search));
state.pageNumber = pageFromSearch(location.search);
state.overviewMode = overviewModeFromSearch(location.search);
const selectors = createSelectors(state);
const theme = createThemeController();
let scanner;
let filePreview;
const modal = createModal({
  state,
  /**
   * Handles the close interaction.
   */
  onClose: () => {scanner?.stopScan(); filePreview?.close();},
});
filePreview = createFilePreview({modal, state});
const photoViewer = createPhotoViewer({state, showModal: modal.showModal});
const photoEditor = createPhotoEditor({
  state, showModal: modal.showModal,
  closeModal: modal.closeModal, action,
});
const navigation = createNavigation({
  state, render, closeModal: modal.closeModal,
});
const {navigate} = navigation;
const shell = createShell({
  root, state, applyTheme: theme.applyTheme, renderModal: modal.renderModal,
});
const home = createHomeView({
  state,
  selectors,
  shell,
  navigate,
  refresh,
  showModal: modal.showModal,
  closeModal: modal.closeModal,
  confirm: modal.confirm,
});
const detail = createDetailView({
  state, selectors, shell, navigate, action,
});
const tastingsView = createTastingsView({
  state,
  selectors,
  shell,
  navigate,
  refresh,
  showModal: modal.showModal,
  closeModal: modal.closeModal,
  confirm: modal.confirm,
});
const auth = createAuthController({
  root,
  state,
  render,
  refresh,
  applyTheme: theme.applyTheme,
  showModal: modal.showModal,
  closeModal: modal.closeModal,
});
const settingsView = createSettingsView(state, auth);
const bottlingForm = createBottlingForm({
  state, selectors,
});
const bottleForm = createBottleForm({
  state, selectors,
});
let externalImport;
const editors = createEditors({
  state, selectors, bottlingForm, bottleForm, ...modal, navigate, action,
  /**
   * Returns the staged image token selected for attachment to the new bottle.
   * @return {*} Selected import-image token, or null or undefined when no image is pending.
   */
  getPendingImageToken: () => externalImport?.getPendingImageToken(),
  /**
   * Notifies the import controller that its staged image has been attached.
   * @return {*} No return value; clears the staged import-image token.
   */
  markImageAttached: () => externalImport?.markImageAttached(),
});
const backup = createBackupController({
  state, render,
  showModal: modal.showModal, closeModal: modal.closeModal,
});
const settings = createSettingsController({
  state, action, navigate, ...modal,
  /**
   * Handles the distillery location changed interaction.
   *
   * @param {*} id Identifier of the affected record.
   */
  onDistilleryLocationChanged: id => {
    if (state.page === 'map') mapView.centerOnUpdatedLocation(id);
  },
});
const mapView = createMapView({state, shell, navigate, settings});
const analyticsView = createAnalyticsView({state, shell});
const warehouseView = createWarehouseView({
  state, shell, navigate, modal,
  refresh,
});
const resolveCode = createCodeResolver({
  state, navigate, toast, ...modal,
});
scanner = createScanner({
  state, showModal: modal.showModal, resolveCode,
});
externalImport = createWhiskybase({
  state,
  navigate,
  showModal: modal.showModal,
  closeModal: modal.closeModal,
  action,
  ...editors,
});
/**
 * Renders the app state.
 *
 * @return {*} Whether the requested condition is met.
 */
function render() {
  if (!state.collection) {
    return;
  }
  if (state.page === 'map') return mapView.render();
  mapView.destroy();
  if (state.page === 'analytics') return analyticsView();
  if (state.page === 'help') return shell(helpView());
  if (state.page === 'warehouse') return warehouseView.render();
  if (state.page === 'tastings-home') return tastingsView.home();
  if (state.page === 'tasting-flight') return tastingsView.flight();
  if (['tastings', 'external-tastings'].includes(state.page)) return tastingsView.list();
  if (['tasting', 'external-tasting'].includes(state.page)) return tastingsView.editor();
  if (state.page === 'detail') {
    return detail();
  }
  if (state.page === 'settings') {
    return shell(settingsView());
  }
  home();
}

/**
 * Reloads the requested resource scope and updates the active view.
 *
 * @param {string=} scope Resource scope to refresh: all, collection or warehouse.
 * @return {!Promise<*>} Completion after refreshing the view and version information.
 */
async function refresh(scope = 'all') {
  const [_, meta] = await Promise.all([
    loadResources(state, requestCachedJson, scope),
    state.version ? Promise.resolve({version: state.version}) : request('/api/version').catch(() => ({version: ''})),
  ]);
  state.version = meta.version;
  if (state.page === 'map') mapView.refreshData();
  else render();
}

/**
 * Executes a user action and refreshes resources, reporting action and refresh failures separately.
 *
 * @param {*} task Task to execute or examine.
 * @param {!Object=} options Options controlling the operation.
 * @return {!Promise<*>} Action outcome, including any refresh error after a successful write.
 */
async function action(task, {scope = 'all'} = {}) {
  return runAction(
    task,
    () => refresh(scope),
    error => toast(error.message, true),
    () => {
      // Action callers may show a success toast immediately afterward. Display
      // the refresh warning after that synchronous completion, not before it.
      setTimeout(() => toast(t('ui.errors.savedButRefreshFailed'), true), 0);
    }
  );
}
navigation.listen();
bindEvents(root, {
  state,
  render,
  action,
  navigate,
  editors,
  settings,
  backup,
  scanner,
  externalImport,
  modal,
  photoViewer,
  photoEditor,
  filePreview,
  theme,
  resolveCode,
  warehouseView,
  detail,
  tastingsView,
  home,
  mapView,
  auth,
});
// The extension can send a second import into an already open manager tab.
// A fragment-only navigation triggers hashchange, not a page reload.
window.addEventListener('hashchange', () => {
  if (state.collection) externalImport.importFromExtension();
});
window.addEventListener('wcm:auth-required', () => {
  auth.init().then(allowed => {if (!allowed) state.collection = null;})
    .catch(() => {});
});
auth.init().then(allowed => allowed ? refresh().then(externalImport.importFromExtension) : null).catch(error => {
  replaceContent(root, renderTemplate('main', {message: error.message, }));
  document.querySelector('#retry-connection').addEventListener('click', () => location.reload());
});
