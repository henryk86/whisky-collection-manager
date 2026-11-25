import {renderedText} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createShell} from '../../public/js/ui/shell.js';
import {createHomeView} from '../../public/js/views/home.js';
import {newBottlingIcon, inventoryScanIcon, settingsIcon, settingsIconPaths}
  from '../../public/js/ui/action-icons.js';

/**
 * Renders shell in the current view.
 * @return {string} Resulting text.
 */
function renderShell() {
  const root = {innerHTML: ''};
  createShell({
    root,
    state: {version: '0.6.50', modal: null},
    /**
     * Updates theme in the current state.
     */
    applyTheme() {},
    /**
     * Renders modal in the current view.
     */
    renderModal() {},
  })('<section></section>');
  return root.innerHTML;
}

/**
 * Renders home for action consistency.test.
 *
 * @return {string} Resulting text.
 */
function renderHome() {
  const previous = {
    document: globalThis.document,
    location: globalThis.location,
    history: globalThis.history,
  };
  let html = '';
  try {
    globalThis.document = {
      /**
       * Derives the query selector result from the supplied values.
       * @return {!Object} Result computed from the supplied inputs.
       */
      querySelector: () => ({
        /**
         * Updates the add event listener state for its caller.
         */
        addEventListener() {},
      }),
      /**
       * Derives the query selector all result from the supplied values.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      querySelectorAll: () => [],
    };
    globalThis.location = {pathname: '/', search: ''};
    globalThis.history = {
      /**
       * Updates the replace state state for its caller.
       */
      replaceState() {},
    };
    const state = {
      collection: {bottlings: [], settings: {}},
      pageNumber: 1,
      pageSize: 24,
      search: '',
      status: 'all',
      completion: 'all',
      sort: 'name',
      view: 'cards',
    };
    const selectors = {
      /**
       * Derives the all bottles result from the supplied values.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      allBottles: () => [],
      /**
       * Derives the bottles result from the supplied values.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      bottles: () => [],
      /**
       * Derives the cover photo result from the supplied values.
       * @return {string} Resulting text.
       */
      coverPhoto: () => '',
      /**
       * Derives the distillery names result from the supplied values.
       * @return {string} Resulting text.
       */
      distilleryNames: () => '',
    };
    createHomeView({
      state, selectors,
      /**
       * Updates the shell state for its caller.
       *
       * @param {*} content Content to render, store or examine.
       */
      shell: content => {html = content;},
    })();
    return html;
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
}

/**
 * Tests input text against the button pattern.
 *
 * @param {*} html HTML markup to render or inspect.
 * @param {*} action Operation or action callback to invoke.
 * @return {*} Result computed from the supplied inputs.
 */
function button(html, action) {
  const re = new RegExp(String.raw`<button\b[^>]*data-act="${action}"[^>]*>[\s\S]*?</button>`);
  const match = renderedText(html).match(re);
  assert.ok(match, `Button ${action} missing`);
  return match[0];
}

test(
  'header and overview use identical SVG symbols and labels for matching actions',
  () => {
    const header = renderShell();
    const home = renderHome();
    for (const [action, label, icon] of [
      ['new', 'Neue Flasche', newBottlingIcon],
      ['scan', 'Inventar scannen', inventoryScanIcon],
    ]) {
      for (const view of [header, home]) {
        const html = button(view, action);
        assert.ok(renderedText(html).includes(renderedText(icon)), `${action}: both views must reuse the same SVG`);
        assert.ok(renderedText(html).includes(`<span>${label}</span>`), `${action}: consistent visible label`);
        assert.ok(renderedText(html).includes(`aria-label="${label}"`), `${action}: consistent accessible name`);
      }
    }
    assert.doesNotMatch(renderedText(header), />Flasche erfassen<|>Scannen</);
    assert.doesNotMatch(renderedText(home), />\+ Neue Flasche|>▣ Inventar scannen/);
  }
);

test(
  'settings are accessible through the side menu with the shared, correct gear icon',
  () => {
    const shell = renderShell();
    assert.doesNotMatch(renderedText(shell), /<button[^>]+data-act="settings"/, 'no duplicate settings action in the header');
    assert.match(renderedText(shell), /<a[^>]+data-act="goto-settings-menu"[^>]*>/);
    assert.match(renderedText(shell), /<a[^>]+data-act="goto-settings-menu"[^>]*>[\s\S]*?Einstellungen\s*<\/a>/);
    assert.ok(renderedText(shell).includes(renderedText(settingsIconPaths)), 'sidebar uses exactly the shared gear drawing');
    const actions = [...renderedText(shell).matchAll(/<button[^>]+data-act="([^"]+)"[^>]*>/g),].map(match => match[1]);
    assert.deepEqual(renderedText(actions).slice(0, 4), ['toggle-theme', 'scan', 'new', 'toggle-menu']);
  }
);

test(
  'settings icon is a clean, symmetrical gear outline without stray paths',
  () => {
    assert.match(renderedText(settingsIcon), /<path d="M10\.5 2h3/);
    assert.match(renderedText(settingsIcon), /<circle cx="12" cy="12" r="3"\/>/);
    assert.doesNotMatch(renderedText(settingsIcon), /H21|M21|<text|<polygon/);
    assert.equal((renderedText(settingsIcon).match(/<svg/g) || []).length, 1);
    assert.equal((renderedText(settingsIcon).match(/<\/svg>/g) || []).length, 1);
  }
);
