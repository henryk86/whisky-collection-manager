import {domElements, domText, assertDom} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import de from '../../public/locales/de.json' with {type: 'json'};
import en from '../../public/locales/en.json' with {type: 'json'};
import {createTranslator} from '../../public/js/i18n/index.js';
import {CASK_GROUPS, CASK_DIMENSIONS, CASK_PHASES} from '../../public/js/domain/flight-casks.js';
import {flightCaskOptionsHtml} from '../../public/js/ui/flight-cask-options.js';
import {flightPlanningHelpHtml} from '../../public/js/ui/flight-planning-help.js';

test('each category, phase and dimension has a label in both languages', async () => {
  for (const [language, messages] of [['de', de], ['en', en]]) {
    const keys = CASK_GROUPS.flatMap(group => [`group.${group}`,
    ...Object.entries(CASK_DIMENSIONS[group]).flatMap(([dimension, values]) =>
      [
        `dimension.${dimension}`,
        ...values.map(value => `subtype.${value}`),
      ])]);
    for (const key of [...keys, ...CASK_PHASES.map(phase => `phase.${phase}`)]) {
      assert.ok(messages[`flightPlan.caskAge.${key}`], `${language}: ${key}`);
    }
    const t = createTranslator(messages, {}, language);
    const html = flightCaskOptionsHtml(t);
    assert.equal(t('flightPlan.caskAge.group.wine'), language === 'de' ? 'Wein' : 'Wine');
    assert.equal((await domElements(html, '[data-flight-plan-cask-subtype-wrap="wine"]')).length, 1);
    assert.doesNotMatch(await domText(html), /flightPlan\.caskAge\./);
    assert.ok((await domElements(html, '[name="flight-cask-group-rum"]')).length > 0);
    await assertDom(html, "[name^=\"flight-cask-feature-rum-\"]", {}, true);
    for (const group of CASK_GROUPS) {
      await assertDom(html, `[name="flight-cask-group-${group}"]`);
    }
    const help = flightPlanningHelpHtml(t);
    assert.doesNotMatch(await domText(help), /flightPlan\.(?:help|caskAge)\./);
    assert.match(await domText(help), /Sauternes/);
    assert.match(await domText(help), /Colheita/);
    assert.match(await domText(help), /Madeira/);
  }
});
