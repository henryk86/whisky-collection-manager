import {domElements, domMatches, domContains, domScope, assertDom} from './component-dom.js';
import {captureContent} from '../helpers/capture-rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createShell} from '../../public/js/ui/shell.js';
import {createHomeView} from '../../public/js/views/home.js';
import {newBottlingIcon, inventoryScanIcon, settingsIcon, settingsIconPaths} from '../../public/js/ui/action-icons.js';

/**
 * Renders shell in the current view.
 * @return {import('../../public/js/ui/render-plan.js').RenderContent} Captured shell plan for native DOM assertions.
 */
function renderShell() {
  const root = {renderedContent: ''};
  createShell({
    mountContent: captureContent,
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
  return root.renderedContent;
}

/**
 * Renders home for action consistency.test.
 *
 * @return {import('../../public/js/ui/render-plan.js').RenderContent} Captured collection view plan for the action assertions.
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
         * Ignores listener registration in this DOM-free test double.
         */
        addEventListener() {},
      }),
      /**
       * Simulates an element query with no matches.
       * @return {Array<never>} Empty match list; the simulated root has no matching elements.
       */
      querySelectorAll: () => [],
    };
    globalThis.location = {pathname: '/', search: ''};
    globalThis.history = {
      /**
       * Suppresses history replacement in the simulated browser.
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
       * Provides an empty collection inventory.
       * @return {Array<never>} Empty physical inventory in this fixture.
       */
      allBottles: () => [],
      /**
       * Provides an empty physical-bottle list.
       * @return {Array<never>} No physical bottles for the requested bottling.
       */
      bottles: () => [],
      /**
       * Simulates a bottling without a cover photo.
       * @return {string} Empty path to exercise the no-photo state.
       */
      coverPhoto: () => '',
      /**
       * Omits distillery labels for this test.
       * @return {string} Empty label; no distillery name is supplied by this fixture.
       */
      distilleryNames: () => '',
    };
    createHomeView({
      state, selectors,
      /**
       * Captures the rendered page in the fixture for later assertions.
       *
       * @param {import('../../public/js/ui/render-plan.js').RenderContent} content Page content passed by the view.
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
 * Selects the rendered action button for native DOM assertions.
 *
 * @param {*} html Captured render content to inspect.
 * @param {*} action Operation or action callback to invoke.
 * @return {*} Result computed from the supplied inputs.
 */
function button(html, action) {
  return domScope(html, `button[data-act="${action}"]`);
}

test(
  'header and overview use identical SVG symbols and labels for matching actions',
  async () => {
    const header = renderShell();
    const home = renderHome();
    for (const [action, label, icon] of [
      ['new', 'Neue Flasche', newBottlingIcon],
      ['scan', 'Inventar scannen', inventoryScanIcon],
    ]) {
      for (const view of [header, home]) {
        const html = button(view, action);
        assert.ok(await domContains(html, icon), `${action}: both views must reuse the same SVG`);
        await assertDom(html, "span", {text: label}, false, `${action}: consistent visible label`);
        await assertDom(html, "button", {"aria-label": label}, false, `${action}: consistent accessible name`);
      }
    }
    assert.equal((await domMatches(header, "*", {"text": new RegExp("^Flasche erfassen$")})) || (await domMatches(header, "*", {"text": new RegExp("^Scannen$")})), false);
    assert.equal((await domMatches(home, "*", {directText: /(?:^\s*\+ Neue Flasche|^\s*▣ Inventar scannen)/})), false);
  }
);

test(
  'settings are accessible through the side menu with the shared, correct gear icon',
  async () => {
    const shell = renderShell();
    assert.equal((await domElements(shell, 'button[data-act="settings"]')).length, 0, 'no duplicate settings action in the header');
    assert.ok((await domElements(shell, 'a[data-act="goto-settings-menu"]')).length > 0);
    await assertDom(shell, "a[data-act=\"goto-settings-menu\"]", {"text": new RegExp("Einstellungen\\s*$")});
    assert.ok(await domContains(shell, settingsIconPaths), 'sidebar uses exactly the shared gear drawing');
    const actions = (await domElements(shell, 'button[data-act]')).map(node => node.attributes['data-act']);
    assert.deepEqual(actions.slice(0, 4), ['toggle-theme', 'scan', 'new', 'toggle-menu']);
  }
);

test(
  'settings icon is a clean, symmetrical gear outline without stray paths',
  async () => {
    await assertDom(settingsIcon, "path[d^=\"M10.5 2h3\"]");
    assert.ok((await domElements(settingsIcon, 'circle[cx="12"][cy="12"][r="3"]')).length > 0);
    await assertDom(settingsIcon, "path[d*=\"H21\"], path[d*=\"M21\"], text, polygon", {}, true);
    assert.equal((await domElements(settingsIcon, 'svg')).length, 1);
  }
);
