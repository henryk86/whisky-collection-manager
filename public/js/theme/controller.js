import {replaceContent} from '../ui/dom-renderer.js';
import {t} from '../i18n/index.js';
import {getThemePreference, effectiveTheme, nextTheme} from './preference.js';
import {themeSunIcon, themeMoonIcon} from '../ui/action-icons.js';
/**
 * Theme is a local browser preference, not collection data.
 *
 * @return {!Object} Structured result for the caller.
 */
export function createThemeController() {
  const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
  let themePreference = getThemePreference();
  /**
   * Updates theme in the current state.
   */
  function applyTheme() {
    const active = effectiveTheme(themePreference, themeMedia.matches);
    document.documentElement.dataset.theme = active;
    document.documentElement.style.colorScheme = active;
    const button = document.querySelector('[data-act=toggle-theme]');
    if (button) {
      replaceContent(button, active === 'dark' ? themeSunIcon : themeMoonIcon);
      button.title = active === 'dark' ? t("ui.theme.enableLight") : t("ui.theme.enableDark");
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-pressed', String(active === 'dark'));
    }
  }

  /**
   * Updates the toggle theme state for its caller.
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
