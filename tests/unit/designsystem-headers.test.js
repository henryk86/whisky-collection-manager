import {fixtureMarkup, renderedText, domElements} from '../helpers/rendering.js';
import {
  pageHeader, sectionHeader, headingTitle, headerActions, backNavigation,
  helpIconButton
} from '../../public/js/ui/headers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import de from '../../public/locales/de.json' with {type: 'json'};
import en from '../../public/locales/en.json' with {type: 'json'};

test(
  'page header escapes text, retains one semantic title and trusted action slots',
  () => {
    const html = pageHeader({
      title: 'A < B',
      eyebrow: 'The "reserve"',
      intro: '<script>x</script>',
      className: 'settings-heading',
      actions: fixtureMarkup('<button data-act="goto-home">Back</button>'),
    });
    assert.ok(domElements(html, 'header[class="section-head ds-page-header settings-heading"]').length > 0);
    assert.match(
      renderedText(html),
      new RegExp('<h2>A &lt; B<span class="heading-period" a' + 'ria-hidden="true">\\.<\\/span><\\/h2>')
    );
    assert.ok(domElements(html, 'header *').some(node => node.text.trim() === 'The "reserve"'));
    assert.ok(!renderedText(html).includes('<script>'));
    assert.match(renderedText(html), /<button data-act="goto-home">Back<\/button>/);
    assert.equal(domElements(html, 'h2').length, 1);
  }
);

test(
  'page header respects disabled decorative punctuation for data-derived bottling names',
  () => {
    const html = pageHeader({
      title: 'Browser Test Blend',
      period: false,
      className: 'detail-page-head',
    });
    assert.match(renderedText(html), /<h2>Browser Test Blend<\/h2>/);
    assert.doesNotMatch(renderedText(html), /heading-period/);
    assert.match(
      renderedText(pageHeader({title: 'Sammlung'})),
      new RegExp('<h2>Sammlung<span class="heading-period" a' + 'ria-hidden="true">\\.<\\/span><\\/h2>')
    );
  }
);

test(
  'section heading keeps actions separate and help inside the heading without injecting inline style',
  () => {
    const help = helpIconButton({
      label: 'Show help', action: 'flight-plan-help',
    });
    const html = sectionHeader({
      title: 'Planning',
      layout: 'tasting-panel-heading',
      titleClass: 'flight-plan-heading-title',
      trailingAction: help,
      actions: fixtureMarkup('<button disabled>Next</button>'),
    });
    assert.match(renderedText(html), /<h3 class="flight-plan-heading-title ds-heading-with-action">Planning/);
    assert.equal(domElements(html, '[class="ds-help-icon-button flight-plan-help-button"]').length, 1);
    assert.equal(domElements(html, '.actions.ds-header-actions > button[disabled]')[0].text, 'Next');
    assert.ok(!renderedText(html).includes('style='));
    assert.match(
      renderedText(headingTitle({
        title: '<&', level: 2, className: 'analytics-section-title',
      })),
      /<h2 class="analytics-section-title">&lt;&amp;<\/h2>/
    );
    assert.throws(() => headingTitle({title: 'wrong', level: 1}), /Heading level/);
    assert.throws(() => sectionHeader({title: 'wrong', layout: 'not-supported'}), /Invalid section header/);
  }
);

test(
  'header actions do not take over behavior and can be disabled without altering data-act',
  () => {
    const html = headerActions(
      fixtureMarkup('<button data-act="edit-bottling" disabled>Bearbeiten</button>'),
      {className: 'detail-head-actions'}
    );
    assert.ok(domElements(html, '[class="actions ds-header-actions detail-head-actions"]').length > 0);
    assert.ok(domElements(html, '[data-act="edit-bottling"][disabled]').length > 0);
  }
);

test(
  'back navigation owns exactly one SVG arrow and has accessible action semantics',
  () => {
    for (const [language, catalog] of [['de', de], ['en', en]]) {
      const text = catalog['common.navigation.backToCollection'];
      assert.doesNotMatch(renderedText(text), /^[←⟵⬅]/u, `${language}: translation contains no icon`);
      const page = backNavigation('goto-home', text, '', 'page-action');
      assert.equal(domElements(page, 'svg').length, 1);
      assert.ok(domElements(page, '[data-act="goto-home"]').length > 0);
      assert.match(renderedText(page), /ds-back-nav--page-action/);
      assert.ok(renderedText(page).includes(`<span>${text}</span>`));
      const inline = backNavigation('back', ` ←  ← ${text}`, 'detail-back');
      assert.equal(domElements(inline, 'svg').length, 1);
      assert.ok(!renderedText(inline).includes('←'), `${language}: no repeated arrow glyph`);
      assert.ok(domElements(inline, '[data-region="detail-back"]').length > 0);
    }
    assert.throws(() => backNavigation('back', 'Back', '', 'invalid'), /Invalid back-navigation/);
    assert.match(renderedText(backNavigation('x', '<img onerror=alert(1)>')), /&lt;img/);
  }
);

test(
  'help icon receives a readable name, a single SVG, and an explicit disabled state',
  () => {
    const html = helpIconButton({label: 'Why "this"?', disabled: true});
    assert.ok(domElements(html, '[aria-label="Why \\"this\\"?"]').length > 0);
    assert.equal(domElements(html, 'button')[0].disabled, true);
    assert.equal(domElements(html, 'svg').length, 1);
  }
);
