import {renderedText, captureContent, domElements} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {themeMoonIcon, themeSunIcon} from '../../public/js/ui/action-icons.js';
import {createThemeController} from '../../public/js/theme/controller.js';
import {createShell} from '../../public/js/ui/shell.js';

test(
  'theme toggle uses shared, device-independent SVGs rather than platform-specific characters',
  () => {
    for (const icon of [themeMoonIcon, themeSunIcon]) {
      assert.match(renderedText(icon), /^<svg class="theme-icon" /);
      assert.ok(domElements(icon, '[viewBox="0 0 24 24"]').length > 0);
      assert.ok(domElements(icon, '[stroke="currentColor"]').length > 0);
      assert.ok(domElements(icon, '[aria-hidden="true"]').length > 0);
      assert.equal(domElements(icon, 'svg').length, 1);
      assert.equal((renderedText(icon).match(/<\/svg>/g) || []).length, 1);
    }
    assert.notEqual(renderedText(themeMoonIcon), renderedText(themeSunIcon));
    const root = {innerHTML: ''};
    createShell({
      mountContent: captureContent,
      root,
      state: {version: '0.8.5', modal: null},
      /**
       * Updates theme in the current state.
       */
      applyTheme() {},
      /**
       * Renders modal in the current view.
       */
      renderModal() {},
    })('');
    assert.ok(renderedText(root.innerHTML).includes(`data-act="toggle-theme"`));
    assert.ok(renderedText(root.innerHTML).includes(renderedText(themeMoonIcon)));
  }
);

test(
  'theme controller changes only the shared SVG, preserving button labels on every device',
  () => {
    const original = {
      window: globalThis.window,
      document: globalThis.document,
      localStorage: globalThis.localStorage,
    };
    const saved = new Map([['whisky-theme', 'light']]);
    const attributes = {};
    const button = {
      innerHTML: '',
      title: '',
      /**
       * Updates attribute in the current state.
       *
       * @param {*} key Key used to select or group values.
       * @param {*} value Value to process.
       */
      setAttribute: (key, value) => {attributes[key] = value;},
    };
    const root = {dataset: {}, style: {}};
    try {
      globalThis.window = {
        /**
         * Derives the match media result from the supplied values.
         * @return {!Object} Result computed from the supplied inputs.
         */
        matchMedia: () =>
        ({
          matches: false,
          /**
           * Ignores listener registration in this DOM-free test double.
           */
          addEventListener() {},
        }),
      };
      globalThis.localStorage = {
        /**
         * Retrieves item from the available state.
         *
         * @param {string} key Key used to select or group values.
         * @return {?string} Stored fixture preference, or null when absent.
         */
        getItem: key => saved.get(key) ?? null,
        /**
         * Updates item in the current state.
         *
         * @param {string} key Key used to select or group values.
         * @param {string} value Value to process.
         * @return {!Map<*, *>} Result computed from the supplied inputs.
         */
        setItem: (key, value) => saved.set(key, value),
      };
      globalThis.document = {
        documentElement: root,
        /**
         * Derives the query selector result from the supplied values.
         * @return {!Object} Result computed from the supplied inputs.
         */
        querySelector: () =>
          button,
      };
      const theme = createThemeController(captureContent);
      assert.equal(renderedText(button.innerHTML), renderedText(themeMoonIcon));
      assert.equal(renderedText(button.title), 'Dark Mode aktivieren');
      assert.equal(renderedText(attributes['aria-pressed']), 'false');
      theme.toggleTheme();
      assert.equal(renderedText(button.innerHTML), renderedText(themeSunIcon));
      assert.equal(renderedText(button.title), 'Light Mode aktivieren');
      assert.equal(renderedText(attributes['aria-pressed']), 'true');
      assert.equal(renderedText(saved.get('whisky-theme')), 'dark');
      theme.toggleTheme();
      assert.equal(renderedText(button.innerHTML), renderedText(themeMoonIcon));
      assert.equal(renderedText(root.dataset.theme), 'light');
    } finally {
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
      }
    }
  }
);
