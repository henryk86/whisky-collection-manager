import {fixtureMarkup, renderedText, domElements} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {sectionWorkspace} from '../../public/js/ui/section-navigation.js';
import {helpView} from '../../public/js/views/help.js';
import {createAnalyticsView} from '../../public/js/views/analytics.js';

test(
  'common section sidebar has a straight gold active marker, no rounded pill, and a mobile selector',
  () => {
    const config = {
      sections: [{id: 'intro', label: 'Einführung'}, {
        id: 'other',
        label: 'Weiter',
      }],
      activeId: 'other', action: 'help-tab', itemAttribute: 'data-help-topic',
      label: 'Hilfethemen', switchKind: 'help',
    };
    const markup = sectionWorkspace(config, fixtureMarkup('<article>Testinhalt</article>'));
    assert.ok(domElements(markup, '[data-help-topic="other"][aria-current="page"]').length > 0);
    assert.doesNotMatch(renderedText(markup), /data-help-topic="intro" aria-current/);
    assert.ok(domElements(markup, '[data-section-switch="help"]').length > 0);
    assert.ok(domElements(markup, 'option[value="other"][selected]').length > 0);
    assert.match(renderedText(markup), /<article>Testinhalt<\/article>/);

  }
);

test('shared section navigation escapes all external values', () => {
  const html = sectionWorkspace({
    sections: [{id: '<id>', label: '<script>'}],
    activeId: '<id>',
    action: '<act>',
    itemAttribute: 'data-section',
    label: '<nav>',
    switchKind: 'analytics',
  }, 'CONTENT');
  assert.equal(domElements(html, 'script').length, 0);
  assert.equal(domElements(html, 'id').length, 0);
  assert.match(renderedText(html), /&lt;script&gt;/);
  assert.match(renderedText(html), /CONTENT/);
});

test(
  'analysis and help render the same workspace and preserve their own content',
  () => {
    const state = {
      collection: {schemaVersion: 6, distilleries: [], bottlings: []},
      analyticsFilters: {}, analyticsPeriod: 'month', selected: 'overview',
    };
    let analysis = '';
    createAnalyticsView({
      state,
      /**
       * Updates the shell state for its caller.
       *
       * @param {*} html HTML markup to render or inspect.
       */
      shell: html => {analysis = html;},
    })();
    const help = helpView();
    for (const html of [analysis, help]) {
      assert.ok(domElements(html, '[class="section-workspace"]').length > 0);
      assert.ok(domElements(html, '[class="section-nav-desktop"]').length > 0);
      assert.ok(domElements(html, '[class="section-nav-mobile"]').length > 0);
    }
    assert.match(renderedText(analysis), /Das Wichtigste auf einen Blick\./);
    assert.ok(domElements(help, '[class="help-steps"]').length > 0);
    assert.ok(domElements(analysis, '[data-section-switch="analytics"]').length > 0);
    assert.ok(domElements(help, '[data-section-switch="help"]').length > 0);
    assert.match(renderedText(help), /data\/warehouse\.json/);
  }
);
