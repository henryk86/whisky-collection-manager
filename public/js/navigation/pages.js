import { t } from '../i18n/index.js';
import { settingsIconPaths } from '../ui/action-icons.js';
/** Main destinations in one place so future pages (e.g. analytics) need only one entry. */
export const MAIN_PAGES = Object.freeze([
    { id: 'home', get label() { return t("navigation.collection"); }, url: '/', action: 'goto-home', icon: '<path d="M3 10.5 12 3l9 7.5V21h-6v-7H9v7H3Z"/>' },
    { id: 'analytics', get label() { return t("navigation.analytics"); }, url: '/?view=analysis', action: 'goto-analysis', icon: '<path d="M4 20V12h4v8M10 20V4h4v16M16 20v-9h4v9"/>' },
    { id: 'warehouse', get label() { return t("navigation.warehouse"); }, url: '/?view=warehouse', action: 'goto-warehouse', icon: '<path d="M3 8l9-5 9 5v13H3Z"/><path d="M3 11h18M8 21v-9h8v9M8 16h8"/>' },
    { id: 'map', get label() { return t("navigation.map"); }, url: '/?view=map', action: 'goto-map', icon: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15M15 6v15"/>' },
    { id: 'settings', get label() { return t("navigation.settings"); }, url: '/?view=settings', action: 'goto-settings-menu', icon: settingsIconPaths },
]);
