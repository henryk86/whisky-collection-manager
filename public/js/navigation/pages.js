import {t} from '../i18n/index.js';
import {settingsIconPaths} from '../ui/action-icons.js';
import {GLENCAIRN_INK} from '../ui/glencairn-icon.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates(
  new URL('./templates/pages.html', import.meta.url));

/**
 * Main destinations in one place so future pages (e.g. analytics) need only one
 * entry.
 */
export const MAIN_PAGES = Object.freeze([
  {
    id: 'home',
    /**
     * Reads the label property from the current state.
     * @return {*} Value returned by the delegated operation.
     */
    get label() {return t("navigation.collection");},
    url: '/',
    action: 'goto-home',
    icon: renderTemplate('iconPath'),
  },
  {
    id: 'tastings-home',
    /**
     * Reads the label property from the current state.
     * @return {*} Value returned by the delegated operation.
     */
    get label() {return t('tastings.homeTitle');},
    url: '/?view=tastings',
    action: 'goto-tastings-home',
    icon: renderTemplate('iconPath2', {
      gLENCAIRNINK: GLENCAIRN_INK,
    }),
    viewBox: '130 50 220 355',
    filled: true,
    navClass: 'nav-glencairn',
  },
  {
    id: 'analytics',
    /**
     * Reads the label property from the current state.
     * @return {*} Value returned by the delegated operation.
     */
    get label() {return t("navigation.analytics");},
    url: '/?view=analysis',
    action: 'goto-analysis',
    icon: renderTemplate('iconPath3'),
  },
  {
    id: 'warehouse',
    /**
     * Reads the label property from the current state.
     * @return {*} Value returned by the delegated operation.
     */
    get label() {return t("navigation.warehouse");},
    url: '/?view=warehouse',
    action: 'goto-warehouse',
    icon: renderTemplate('iconPath4'),
  },
  {
    id: 'map',
    /**
     * Reads the label property from the current state.
     * @return {*} Value returned by the delegated operation.
     */
    get label() {return t("navigation.map");},
    url: '/?view=map',
    action: 'goto-map',
    icon: renderTemplate('iconPath5'),
  },
  {
    id: 'help',
    /**
     * Reads the label property from the current state.
     * @return {*} Value returned by the delegated operation.
     */
    get label() {return t("navigation.help");},
    url: '/?view=help',
    action: 'goto-help',
    icon: renderTemplate('iconCircle'),
  },
  {
    id: 'settings',
    /**
     * Reads the label property from the current state.
     * @return {*} Value returned by the delegated operation.
     */
    get label() {return t("navigation.settings");},
    url: '/?view=settings',
    action: 'goto-settings-menu',
    icon: settingsIconPaths,
  },
]);
