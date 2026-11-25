import {composeMarkup} from './render-plan.js';
import {replaceContent, materialize} from './dom-renderer.js';
import {actionButton} from './buttons.js';
import {t} from '../i18n/index.js';
import {newBottlingIcon, inventoryScanIcon, themeMoonIcon, closeIcon}
  from './action-icons.js';
import {MAIN_PAGES} from '../navigation/pages.js';
import {reconcileChildren} from './dom-reconcile.js';
import {escapeHtml} from './dom.js';
import {loadTemplates} from './templates.js';

const renderTemplate = await loadTemplates('components/shell.html');

/**
 * Creates shell for shell.
 *
 * @param {!Object} options Optional configuration for the operation.
 * @return {Function} Entries transformed for the consuming code.
 */
export function createShell({root, state, applyTheme, renderModal, mountContent = replaceContent}) {
  let displayedRoute = null;
  /**
   * Transforms the entries used by shell.
   *
   * @param {*} content Content to render, store or examine.
   */
  function shell(content) {
    // Data updates must not tear down the header, page scroll container and
    // modal host. Rebuilding #app briefly sends long pages to the top,
    // especially after deleting a photo or attachment. Only actual route
    // changes require a full shell; they scroll to the top in navigation.
    const route = [
      state.page,
      state.selected,
      state.tastingId,
      state.flightId,
      state.auth?.user?.id || 'guest',
    ].join('::');
    const main = root.querySelector?.(':scope > main');
    if (main && displayedRoute === route) {
      const scrollY = typeof window !== 'undefined' ? window.scrollY : null;
      const next = materialize(content, root.ownerDocument, main);
      // All routes share one reconciler. Interactive widgets mark their
      // subtree with data-reconcile="replace" to remount local handlers.
      reconcileChildren(main, next);
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
    mountContent(root, renderTemplate('back', {
      themeMoonIcon: themeMoonIcon,
      inventoryScanIcon: inventoryScanIcon,
      newBottlingIcon: newBottlingIcon,
      closeIcon: closeIcon,
      navigationLinks: composeMarkup(MAIN_PAGES.map(item => renderTemplate('a', {
        url: item.url,
        action: item.action,
        homeAttributes: item.id === state.page || (item.id === 'home' && state.page === 'detail') ||
          (item.id === 'tastings-home' && ['tastings', 'tasting', 'external-tasting', 'tasting-flight'].includes(state.page)) ? {"aria-current": "page"} : {},
        navClass: item.navClass || '',
        viewBox: item.viewBox || '0 0 24 24',
        filled: item.filled ? 'currentColor' : 'none',
        stroke: item.filled ? 'none' : 'currentColor',
        icon: item.icon,
        label: item.label,
      }))),
      muted: state.auth?.user ? renderTemplate('muted', {
        username: state.auth.user.username,
        authOpenChangeButton: actionButton({
          label: t('auth.changeTitle'),
          action: 'auth-open-change',
        }),
        authLogoutButton: actionButton({
          label: t('auth.signOut'),
          action: 'auth-logout',
        }),
      }) :
        actionButton({label: t('auth.signIn'), action: 'auth-open-login'}),
      content: content,
      footer: t('ui.shell.footer', {version: state.version ? `v${state.version}` : t('ui.status.unknownVersion'), }),
    }));
    applyTheme();
    if (state.modal) {
      renderModal();
    }
  }
  return shell;
}
