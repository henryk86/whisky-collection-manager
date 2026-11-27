import {replaceContent} from '../ui/dom-renderer.js';
import {t} from '../i18n/index.js';
import {getThemePreference, effectiveTheme, nextTheme} from './preference.js';
import {themeSunIcon, themeMoonIcon} from '../ui/action-icons.js';
/**
 * Theme is a local browser preference, not collection data.
 *
 * @param {((element: Element, content: *) => void)=} mountContent Content mount boundary.
 * @return {!Object} Theme application and switching operations.
 */
export function createThemeController(mountContent = replaceContent) {
  const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
  let themePreference = getThemePreference();
  /**
   * Applies the effective theme to the document and updates the theme-switching control.
   */
  function applyTheme() {
    const active = effectiveTheme(themePreference, themeMedia.matches);
    document.documentElement.dataset.theme = active;
    document.documentElement.style.colorScheme = active;
    const button = /** @type {HTMLButtonElement|null} */ (document.querySelector('[data-act=toggle-theme]'));
    if (button) {
      mountContent(button, active === 'dark' ? themeSunIcon : themeMoonIcon);
      button.title = active === 'dark' ? t("ui.theme.enableLight") : t("ui.theme.enableDark");
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-pressed', String(active === 'dark'));
    }
  }

  /**
   * Persists the next theme preference and applies it immediately.
   */
  function toggleTheme() {
    themePreference = nextTheme(effectiveTheme(themePreference, themeMedia.matches));
    try {
      localStorage.setItem('whisky-theme', themePreference);
    }
    catch {
    }
    applyTheme();
  }
  themeMedia.addEventListener?.('change', () => {
    if (themePreference === 'system') {
      applyTheme();
    }
  });
  applyTheme();
  return {
    applyTheme, toggleTheme,
  };
}
