import { t } from '../i18n/index.js';
import { parseRoute, routeUrl } from './routes.js';
import { homePageUrl, pageFromSearch, overviewModeFromSearch } from '../domain/pagination.js';
/** History changes navigate to the page top; a scanned bottle is highlighted, not focused. */
export function createNavigation({ state, render, closeModal, browser = window }) {
    function navigate(page, selected = null, { replace = false, highlightBottleId = null } = {}) {
        const url = page === 'home' ? homePageUrl(state.pageNumber || 1, state.overviewMode) : routeUrl(page, selected, page === 'warehouse' ? {roomId:state.warehouseRoomId, furnitureId:state.warehouseFurnitureId} : state.analyticsFilters);
        if (browser.location.pathname + browser.location.search !== url) {
            browser.history[replace ? 'replaceState' : 'pushState']({
                whiskyRoute: true
            }, '', url);
        }
        if (state.modal) {
            closeModal(true);
        }
        state.page = page;
        state.selected = selected;
        state.highlightBottleId = highlightBottleId;
        render();
        browser.scrollTo(0, 0);
    }
    function restoreRoute() {
        if (state.modal) {
            closeModal(true);
        }
        const route = parseRoute(browser.location.search);
        state.page = route.page;
        state.selected = route.selected;
        if (route.page === 'analytics') state.analyticsFilters = route.filters;
        if (route.page === 'warehouse') { state.warehouseRoomId = route.roomId; state.warehouseFurnitureId = route.furnitureId; }
        if (route.page === 'home') {
            state.pageNumber = pageFromSearch(browser.location.search);
            state.overviewMode = overviewModeFromSearch(browser.location.search);
        }
        state.highlightBottleId = null;
        render();
    }
    function listen() {
        browser.addEventListener('popstate', restoreRoute);
    }
    return {
        navigate, restoreRoute, listen
    };
}
