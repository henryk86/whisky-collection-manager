import {domElements, domText, assertDom} from './component-dom.js';
import {fixtureMarkup} from '../helpers/capture-rendering.js';
import {pageHeader, sectionHeader, headingTitle, headerActions, backNavigation, helpIconButton} from '../../public/js/ui/headers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import de from '../../public/locales/de.json' with {type: 'json'};
import en from '../../public/locales/en.json' with {type: 'json'};

test(
  'page header escapes text, retains one semantic title and trusted action slots',
  async () => {
    const html = pageHeader({
      title: 'A < B',
      eyebrow: 'The "reserve"',
      intro: '<script>x</script>',
      className: 'settings-heading',
      actions: fixtureMarkup('<button data-act="goto-home">Back</button>'),
    });
    assert.ok((await domElements(html, 'header[class="section-head ds-page-header settings-heading"]')).length > 0);
    await assertDom(html, "h2:has(> span.heading-period[aria-hidden=\"true\"])", {directText: "A < B"});
    assert.ok((await domElements(html, 'header *')).some(node => node.text.trim() === 'The "reserve"'));
    await assertDom(html, 'script', {}, true);
    await assertDom(html, "button[data-act=\"goto-home\"]", {"text": new RegExp("^Back$")});
    assert.equal((await domElements(html, 'h2')).length, 1);
  }
);

test(
  'page header respects disabled decorative punctuation for data-derived bottling names',
  async () => {
    const html = pageHeader({
      title: 'Browser Test Blend',
      period: false,
      className: 'detail-page-head',
    });
    await assertDom(html, "h2", {"text": new RegExp("^Browser Test Blend$")});
    await assertDom(html, ".heading-period", {}, true);
    await assertDom(pageHeader({title: 'Sammlung'}), "h2:has(> span.heading-period[aria-hidden=\"true\"])", {directText: "Sammlung"});
  }
);

test(
  'section heading keeps actions separate and help inside the heading without injecting inline style',
  async () => {
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
    await assertDom(html, "h3[class=\"flight-plan-heading-title ds-heading-with-action\"]", {"text": new RegExp("Planning")});
    assert.equal((await domElements(html, '[class="ds-help-icon-button flight-plan-help-button"]')).length, 1);
    assert.equal((await domElements(html, '.actions.ds-header-actions > button[disabled]'))[0].text, 'Next');
    await assertDom(html, '[style]', {}, true);
    await assertDom(headingTitle({
      title: '<&', level: 2, className: 'analytics-section-title',
    }), "h2[class=\"analytics-section-title\"]", {"text": new RegExp("^<&$")});
    assert.throws(() => headingTitle({title: 'wrong', level: 1}), /Heading level/);
    assert.throws(() => sectionHeader({title: 'wrong', layout: 'not-supported'}), /Invalid section header/);
  }
);

test(
  'header actions do not take over behavior and can be disabled without altering data-act',
  async () => {
    const html = headerActions(
      fixtureMarkup('<button data-act="edit-bottling" disabled>Bearbeiten</button>'),
      {className: 'detail-head-actions'}
    );
    assert.ok((await domElements(html, '[class="actions ds-header-actions detail-head-actions"]')).length > 0);
    assert.ok((await domElements(html, '[data-act="edit-bottling"][disabled]')).length > 0);
  }
);

test(
  'back navigation owns exactly one SVG arrow and has accessible action semantics',
  async () => {
    for (const [language, catalog] of [['de', de], ['en', en]]) {
      const text = catalog['common.navigation.backToCollection'];
      assert.doesNotMatch(text, /^[←⟵⬅]/u, `${language}: translation contains no icon`);
      const page = backNavigation('goto-home', text, '', 'page-action');
      assert.equal((await domElements(page, 'svg')).length, 1);
      assert.ok((await domElements(page, '[data-act="goto-home"]')).length > 0);
      await assertDom(page, ".ds-back-nav--page-action");
      await assertDom(page, "span", {text});
      const inline = backNavigation('back', ` ←  ← ${text}`, 'detail-back');
      assert.equal((await domElements(inline, 'svg')).length, 1);
      assert.ok(!(await domText(inline)).includes('←'), `${language}: no repeated arrow glyph`);
      assert.ok((await domElements(inline, '[data-region="detail-back"]')).length > 0);
    }
    assert.throws(() => backNavigation('back', 'Back', '', 'invalid'), /Invalid back-navigation/);
    assert.match(await domText(backNavigation('x', '<img onerror=alert(1)>')), new RegExp("<img"));
  }
);

test(
  'help icon receives a readable name, a single SVG, and an explicit disabled state',
  async () => {
    const html = helpIconButton({label: 'Why "this"?', disabled: true});
    assert.ok((await domElements(html, '[aria-label="Why \\"this\\"?"]')).length > 0);
    assert.equal((await domElements(html, 'button'))[0].disabled, true);
    assert.equal((await domElements(html, 'svg')).length, 1);
  }
);
