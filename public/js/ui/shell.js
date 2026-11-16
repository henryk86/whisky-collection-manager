import { t } from '../i18n/index.js';
import { newBottlingIcon, inventoryScanIcon, themeMoonIcon } from './action-icons.js';
import { MAIN_PAGES } from '../navigation/pages.js';
import { reconcileChildren } from './dom-reconcile.js';
export function createShell({ root, state, applyTheme, renderModal }) {
    let displayedRoute = null;
    function shell(content) {
        // Data updates must not tear down the header, page scroll container and
        // modal host. Rebuilding #app briefly sends long pages to the top,
        // especially after deleting a photo or attachment. Only actual route
        // changes require a full shell; they scroll to the top in navigation.
        const route = [state.page, state.selected, state.tastingId, state.flightId].join('::');
        const liveRegions = ['detail', 'settings', 'help'].includes(state.page);
        const main = root.querySelector?.(':scope > main');
        if (main && displayedRoute === route) {
            const scrollY = typeof window !== 'undefined' ? window.scrollY : null;
            const next = document.createElement('template');
            next.innerHTML = content;
            if (liveRegions && main.hasAttribute('data-live-regions')) {
                // Only pages with delegated handlers opt in: other pages rebuild
                // controls with view-local lifecycle hooks after each render.
                reconcileChildren(main, next.content);
            } else {
                main.replaceChildren(next.content);
            }
            // Guard against scroll anchoring changing the viewport when a
            // replaced section is shorter (e.g. one fewer photo tile).
            if (scrollY != null && Math.abs(window.scrollY - scrollY) > 1) {
                window.scrollTo({top: scrollY, left: 0, behavior: 'instant'});
            }
            applyTheme();
            if (state.modal) renderModal();
            return;
        }
        displayedRoute = route;
        root.innerHTML = `<header class="site-header">
    <div class="header-inner">
    <div class="brand" role="button" tabindex="0" data-act="back" aria-label="${t("ui.navigation.backToCollection")}">
    <span class="brand-emblem" aria-hidden="true">
    <img class="brand-logo" src="/assets/logo.svg" alt="" width="57" height="57">
    </span>
    <div class="brand-copy">
    <span class="brand-overline">${t("ui.branding.privateReserve")}</span>
    <h1>${t("ui.branding.whiskyLabel")} <em>${t("ui.branding.collectionLabel")}</em>
    </h1>
    </div>
    </div>
    <div class="top-actions">
    <button class="btn header-btn theme-toggle" type="button" data-act="toggle-theme" aria-label="${t("ui.theme.toggle")}" title="${t("ui.theme.toggle")}">${themeMoonIcon}</button>
    <button class="btn header-btn" type="button" data-act="scan" aria-label="${t("collection.actions.scanInventory")}" title="${t("collection.actions.scanInventory")}">${inventoryScanIcon}<span>${t("collection.actions.scanInventory")}</span></button>
    <button class="btn primary" type="button" data-act="new" aria-label="${t("collection.actions.newBottle")}" title="${t("collection.actions.newBottle")}">${newBottlingIcon}<span>${t("collection.actions.newBottle")}</span></button>
    <button class="btn header-btn menu-button" type="button" data-act="toggle-menu" id="menu-button" aria-label="${t("ui.navigation.openSideMenu")}" aria-expanded="false" aria-controls="site-drawer" title="${t("ui.navigation.menu")}"><svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>
    </div>
    </div>
    </header>
    <div class="site-drawer-backdrop" data-act="close-menu" hidden></div>
    <aside class="site-drawer" id="site-drawer" aria-label="${t("ui.navigation.sideMenu")}" hidden>
      <div class="site-drawer-head"><h2>${t("ui.navigation.label")}</h2><button type="button" class="btn small" data-act="close-menu" aria-label="${t("ui.navigation.closeMenu")}">✕</button></div>
      <nav class="site-nav" aria-label="${t("ui.navigation.primary")}">${MAIN_PAGES.map(item => `
        <a href="${item.url}" data-act="${item.action}" ${item.id === state.page || (item.id === 'home' && state.page === 'detail') || (item.id === 'tastings-home' && ['tastings','tasting','external-tasting','tasting-flight'].includes(state.page)) ? 'aria-current="page"' : ''}>
          <svg class="${item.navClass || ''}" viewBox="${item.viewBox || '0 0 24 24'}" fill="${item.filled?'currentColor':'none'}" stroke="${item.filled?'none':'currentColor'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${item.icon}</svg>${item.label}
        </a>`).join('')}</nav>
    </aside>
    <main${liveRegions ? ' data-live-regions' : ''}>${content}</main>
    <footer class="site-footer">
    <span>${t("ui.branding.whiskyCollection")}</span>
    <span>${t('ui.shell.footer', {version: state.version ? `v${state.version}` : t('ui.status.unknownVersion')})}</span>
    </footer>
    <div id="modal-root">
    </div>`;
        applyTheme();
        if (state.modal) {
            renderModal();
        }
    }
    return shell;
}
