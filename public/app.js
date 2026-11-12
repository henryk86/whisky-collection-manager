import { t } from './js/i18n/index.js';
/** Composition root: create feature controllers and connect them, then load the collection. */
import { request } from './js/api.js';
import { initializeLanguage } from './js/i18n/index.js';
import { createState } from './js/state.js';
import { pageFromSearch, overviewModeFromSearch } from './js/domain/pagination.js';
import { createSelectors } from './js/domain/selectors.js';
import { parseRoute } from './js/navigation/routes.js';
import { createNavigation } from './js/navigation/controller.js';
import { createThemeController } from './js/theme/controller.js';
import { createModal } from './js/ui/modal.js';
import { createPhotoViewer } from './js/ui/photo-viewer.js';
import { createCutoutController } from './js/features/cutout/controller.js';
import { createShell } from './js/ui/shell.js';
import { escapeHtml } from './js/ui/dom.js';
import { toast } from './js/ui/notifications.js';
import { createHomeView } from './js/views/home.js';
import { createDetailView } from './js/views/detail.js';
import { createSettingsView } from './js/views/settings.js';
import { createMapView } from './js/views/map.js';
import { createAnalyticsView } from './js/views/analytics.js';
import { createWarehouseView } from './js/views/warehouse.js';
import { createBottlingForm } from './js/features/forms/bottling.js';
import { createBottleForm } from './js/features/forms/bottle.js';
import { createEditors } from './js/features/editor-controller.js';
import { createSettingsController } from './js/features/settings-controller.js';
import { createBackupController } from './js/features/backups/controller.js';
import { createCodeResolver } from './js/features/scanner/resolve-code.js';
import { createScanner } from './js/features/scanner/controller.js';
import { createWhiskybase } from './js/features/whiskybase/controller.js';
import { bindEvents } from './js/events.js';
await initializeLanguage();
const root = document.querySelector('#app');
const state = createState(parseRoute(location.search));
state.pageNumber = pageFromSearch(location.search);
state.overviewMode = overviewModeFromSearch(location.search);
const selectors = createSelectors(state);
const theme = createThemeController();
let scanner;
const modal = createModal({
    state, onClose: () => scanner?.stopScan()
});
const photoViewer = createPhotoViewer({ state, showModal: modal.showModal });
const cutout = createCutoutController({ state, showModal: modal.showModal, closeModal: modal.closeModal, action });
const navigation = createNavigation({
    state, render, closeModal: modal.closeModal
});
const { navigate } = navigation;
const shell = createShell({
    root, state, applyTheme: theme.applyTheme, renderModal: modal.renderModal
});
const home = createHomeView({
    state, selectors, shell
});
const detail = createDetailView({
    state, selectors, shell, navigate, action
});
const settingsView = createSettingsView(state);
const bottlingForm = createBottlingForm({
    state, selectors
});
const bottleForm = createBottleForm({
    state, selectors
});
let whiskybase;
const editors = createEditors({
    state, selectors, bottlingForm, bottleForm, ...modal, navigate, action, refresh,
    getPendingImageToken: () => whiskybase?.getPendingImageToken(),
    markImageAttached: () => whiskybase?.markImageAttached()
});
const backup = createBackupController({ state, render, showModal: modal.showModal, closeModal: modal.closeModal });
const settings = createSettingsController({
    state, action, navigate, ...modal
});
const mapView = createMapView({ state, shell, navigate, settings });
const analyticsView = createAnalyticsView({ state, shell });
const warehouseView = createWarehouseView({state, shell, navigate, modal, refresh});
const resolveCode = createCodeResolver({
    state, navigate, toast, ...modal
});
scanner = createScanner({
    state, showModal: modal.showModal, resolveCode
});
whiskybase = createWhiskybase({
    state, navigate, showModal: modal.showModal, closeModal: modal.closeModal, action, ...editors
});
function render() {
    if (!state.collection) {
        return;
    }
    if (state.page === 'map') return mapView.render();
    mapView.destroy();
    if (state.page === 'analytics') return analyticsView();
    if (state.page === 'warehouse') return warehouseView.render();
    if (state.page === 'detail') {
        return detail();
    }
    if (state.page === 'settings') {
        return shell(settingsView());
    }
    home();
}
async function refresh() {
    const [collection, warehouse, meta] = await Promise.all([
        request('/api/collection'),
        request('/api/warehouse'),
        state.version ? Promise.resolve({ version: state.version }) : request('/api/version').catch(() => ({ version: '' }))
    ]);
    state.collection = collection;
    state.warehouse = warehouse;
    state.version = meta.version;
    render();
}
async function action(task) {
    try {
        const result = await task();
        await refresh();
        return result;
    }
    catch (error) {
        toast(error.message, true);
    }
}
navigation.listen();
bindEvents(root, {
    state, render, action, navigate, editors, settings, backup, scanner, whiskybase, modal, photoViewer, cutout, theme, resolveCode, warehouseView
});
// The extension can send a second import into an already open manager tab.
// A fragment-only navigation triggers hashchange, not a page reload.
window.addEventListener('hashchange', () => {
    if (state.collection) whiskybase.importFromExtension();
});
refresh().then(whiskybase.importFromExtension).catch(error => {
    root.innerHTML = `<main>
    <h2>${t("ui.errors.serverConnectionFailed")}</h2>
    <p>${escapeHtml(error.message)}</p>
    <button class="btn" id="retry-connection">${t("ui.errors.retry")}</button>
    </main>`;
    document.querySelector('#retry-connection').addEventListener('click', () => location.reload());
});
