import {renderedText} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import de from '../../public/locales/de.json' with {type: 'json'};
import en from '../../public/locales/en.json' with {type: 'json'};
import {createTranslator} from '../../public/js/i18n/index.js';
import {
  CASK_GROUPS, CASK_DIMENSIONS, CASK_PHASES,
} from '../../public/js/domain/flight-casks.js';
import {
  flightCaskOptionsHtml, readFlightCaskFilters, syncFlightCaskOptions,
  resetFlightCaskOptions,
} from '../../public/js/ui/flight-cask-options.js';
import {
  flightPlanningHelpHtml,
} from '../../public/js/ui/flight-planning-help.js';

test('each category, phase and dimension has a label in both languages', () => {
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
    assert.equal(renderedText(t('flightPlan.caskAge.group.wine')), renderedText(language === 'de' ? 'Wein' : 'Wine'));
    assert.equal((renderedText(html).match(/data-flight-plan-cask-subtype-wrap="wine"/g) || []).length, 1);
    assert.doesNotMatch(renderedText(html), /flightPlan\.caskAge\./);
    assert.match(renderedText(html), /name="flight-cask-group-rum"/);
    assert.doesNotMatch(renderedText(html), /name="flight-cask-feature-rum-/);
    for (const group of CASK_GROUPS) {
      assert.ok(renderedText(html).includes(`name="flight-cask-group-${group}"`));
    }
    const help = flightPlanningHelpHtml(t);
    assert.doesNotMatch(renderedText(help), /flightPlan\.(?:help|caskAge)\./);
    assert.match(renderedText(help), /Sauternes/);
    assert.match(renderedText(help), /Colheita/);
    assert.match(renderedText(help), /Madeira/);
  }
});

test('only selected groups contribute their chosen refinements', () => {
  const inputs = new Map([
    ['flight-cask-group-wine', {checked: true}],
    ['flight-cask-feature-wine-color-whiteWine', {checked: true}],
    ['flight-cask-feature-wine-style-sweetWine', {checked: true}],
    ['flight-cask-group-rum', {checked: true}],
    ['flight-cask-group-port', {checked: false}],
    ['flight-cask-feature-port-style-tawny', {checked: true}],
  ]);
  const wrapper = {hidden: true};
  const detailGroup = {hidden: true};
  const summary = {textContent: ''};
  const phase = {value: 'finish'};
  const t = createTranslator(de, en, 'de');
  const details = ['wine', 'port', 'sherry'].map(group => ({
    hidden: true,
    dataset: {flightPlanCaskSubtypeWrap: group},
    open: false,
    counter: {textContent: ''},
    /**
     * Returns the detail counter.
     * @return {!Object} Counter node.
     */
    querySelector() {return this.counter;},
  }));
  const root = {
    /**
     * Looks up the fake planner wrapper or checkbox by its name.
     * @param {string} selector Selector used by the planner.
     * @return {?Object} Simulated element if present.
     */
    querySelector(selector) {
      if (selector === '[data-flight-plan-cask-group-wrap]') return wrapper;
      if (selector === '[data-flight-plan-cask-details]') return detailGroup;
      if (selector === '[data-flight-plan-cask-selection]') return summary;
      if (selector === '[data-flight-plan-cask-phase]') return phase;
      return inputs.get(renderedText(selector).match(/^\[name="(.+)"\]$/)?.[1]) || null;
    },
    /**
     * Provides the simulated contextual refinement elements.
     * @param {string} selector Selector used to read details or inputs.
     * @return {!Array<!Object>} Matching simulated elements.
     */
    querySelectorAll(selector) {
      return selector === '[name^="flight-cask-"]' ? [...inputs.values()] : details;
    },
  };
  assert.deepEqual(readFlightCaskFilters(root), {
    wine: {color: ['whiteWine'], style: ['sweetWine']}, rum: {},
  });
  syncFlightCaskOptions(root, true, t);
  assert.equal(renderedText(wrapper.hidden), false);
  assert.equal(renderedText(detailGroup.hidden), false);
  assert.equal(renderedText(details[0].open), true);
  assert.equal(renderedText(details[0].counter.textContent), '2 ausgewählt');
  assert.match(renderedText(summary.textContent), /Wein.*Rum/);
  details[0].open = false;
  assert.deepEqual(details.map(detail => detail.hidden), [false, true, true]);
  inputs.get('flight-cask-group-port').checked = true;
  syncFlightCaskOptions(root, true, t);
  assert.deepEqual(readFlightCaskFilters(root).port, {style: ['tawny']});
  assert.equal(renderedText(details[1].hidden), false);
  assert.equal(renderedText(details[0].open), false);
  assert.equal(renderedText(details[1].open), true);
  syncFlightCaskOptions(root, false, t);
  assert.equal(renderedText(wrapper.hidden), true);
  assert.ok(details.every(detail => detail.hidden));
  resetFlightCaskOptions(root);
  syncFlightCaskOptions(root, true, t);
  assert.deepEqual(readFlightCaskFilters(root), {});
  assert.equal(renderedText(phase.value), 'any');
  assert.equal(renderedText(detailGroup.hidden), true);
  assert.equal(renderedText(summary.textContent), 'Alle Fassgruppen');
});
