import {domElements, domText, assertDom} from './component-dom.js';
import {fixtureMarkup} from '../helpers/capture-rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {sectionWorkspace} from '../../public/js/ui/section-navigation.js';
import {helpView} from '../../public/js/views/help.js';
import {createAnalyticsView} from '../../public/js/views/analytics.js';

test(
  'common section sidebar has a straight gold active marker, no rounded pill, and a mobile selector',
  async () => {
    const config = {
      sections: [{id: 'intro', label: 'Einführung'}, {
        id: 'other',
        label: 'Weiter',
      }],
      activeId: 'other', action: 'help-tab', itemAttribute: 'data-help-topic',
      label: 'Hilfethemen', switchKind: 'help',
    };
    const markup = sectionWorkspace(config, fixtureMarkup('<article>Testinhalt</article>'));
    assert.ok((await domElements(markup, '[data-help-topic="other"][aria-current="page"]')).length > 0);
    await assertDom(markup, "[data-help-topic=\"intro\"][aria-current]", {}, true);
    assert.ok((await domElements(markup, '[data-section-switch="help"]')).length > 0);
    assert.ok((await domElements(markup, 'option[value="other"][selected]')).length > 0);
    await assertDom(markup, "article", {"text": new RegExp("^Testinhalt$")});

  }
);

test('shared section navigation escapes all external values', async () => {
  const html = sectionWorkspace({
    sections: [{id: '<id>', label: '<script>'}],
    activeId: '<id>',
    action: '<act>',
    itemAttribute: 'data-section',
    label: '<nav>',
    switchKind: 'analytics',
  }, 'CONTENT');
  assert.equal((await domElements(html, 'script')).length, 0);
  assert.equal((await domElements(html, 'id')).length, 0);
  assert.match(await domText(html), new RegExp("<script>"));
  assert.match(await domText(html), /CONTENT/);
});

test(
  'analysis and help render the same workspace and preserve their own content',
  async () => {
    const state = {
      collection: {schemaVersion: 8, distilleries: [], bottlings: []},
      analyticsFilters: {}, analyticsPeriod: 'month', selected: 'overview',
    };
    let analysis = '';
    createAnalyticsView({
      state,
      /**
       * Updates the shell state for its caller.
       *
       * @param {*} html Captured render content to inspect.
       */
      shell: html => {analysis = html;},
    })();
    const help = helpView();
    for (const html of [analysis, help]) {
      assert.ok((await domElements(html, '[class="section-workspace"]')).length > 0);
      assert.ok((await domElements(html, '[class="section-nav-desktop"]')).length > 0);
      assert.ok((await domElements(html, '[class="section-nav-mobile"]')).length > 0);
    }
    assert.match(await domText(analysis), /Das Wichtigste auf einen Blick\./);
    assert.ok((await domElements(help, '[class="help-steps"]')).length > 0);
    assert.ok((await domElements(analysis, '[data-section-switch="analytics"]')).length > 0);
    assert.ok((await domElements(help, '[data-section-switch="help"]')).length > 0);
    assert.match(await domText(help), /data\/warehouse\.json/);
  }
);
