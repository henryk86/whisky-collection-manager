import {t} from '../i18n/index.js';
import {settingsIconPaths} from '../ui/action-icons.js';
import {GLENCAIRN_INK} from '../ui/glencairn-icon.js';
import {loadTemplates} from '../ui/templates.js';

const renderTemplate = await loadTemplates('icons/pages.html');

/**
 * Main destinations in one place so future pages (e.g. analytics) need only one
 * entry.
 */
export const MAIN_PAGES = Object.freeze([
  {
    id: 'home',
    /**
     * Resolves the collection navigation label in the active language.
     * @return {*} Localized collection label.
     */
    get label() {return t("navigation.collection");},
    url: '/',
    action: 'goto-home',
    icon: renderTemplate('iconPath'),
  },
  {
    id: 'tastings-home',
    /**
     * Resolves the tasting navigation label in the active language.
     * @return {*} Localized tasting label.
     */
    get label() {return t('tastings.homeTitle');},
    url: '/?view=tastings',
    action: 'goto-tastings-home',
    icon: renderTemplate('iconPath2', {glassOutlinePath: GLENCAIRN_INK, }),
    viewBox: '130 50 220 355',
    filled: true,
    navClass: 'nav-glencairn',
  },
  {
    id: 'analytics',
    /**
     * Resolves the analytics navigation label in the active language.
     * @return {*} Localized analytics label.
     */
    get label() {return t("navigation.analytics");},
    url: '/?view=analysis',
    action: 'goto-analysis',
    icon: renderTemplate('iconPath3'),
  },
  {
    id: 'warehouse',
    /**
     * Resolves the warehouse navigation label in the active language.
     * @return {*} Localized warehouse label.
     */
    get label() {return t("navigation.warehouse");},
    url: '/?view=warehouse',
    action: 'goto-warehouse',
    icon: renderTemplate('iconPath4'),
  },
  {
    id: 'map',
    /**
     * Resolves the map navigation label in the active language.
     * @return {*} Localized map label.
     */
    get label() {return t("navigation.map");},
    url: '/?view=map',
    action: 'goto-map',
    icon: renderTemplate('iconPath5'),
  },
  {
    id: 'help',
    /**
     * Resolves the help navigation label in the active language.
     * @return {*} Localized help label.
     */
    get label() {return t("navigation.help");},
    url: '/?view=help',
    action: 'goto-help',
    icon: renderTemplate('iconCircle'),
  },
  {
    id: 'settings',
    /**
     * Resolves the settings navigation label in the active language.
     * @return {*} Localized settings label.
     */
    get label() {return t("navigation.settings");},
    url: '/?view=settings',
    action: 'goto-settings-menu',
    icon: settingsIconPaths,
  },
]);
