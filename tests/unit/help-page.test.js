import {renderedText, domElements} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseRoute, routeUrl} from '../../public/js/navigation/routes.js';
import {MAIN_PAGES} from '../../public/js/navigation/pages.js';
import {HELP_TOPICS, helpView, activateHelpTopic}
  from '../../public/js/views/help.js';
import {mapLegendHtml} from '../../public/js/views/map.js';

test(
  'help route and drawer destination work on direct navigation and reload',
  () => {
    assert.deepEqual(parseRoute('?view=help'), {page: 'help', selected: null});
    assert.equal(renderedText(routeUrl('help')), '/?view=help');
    assert.ok(MAIN_PAGES.some(item => item.id === 'help' && item.action === 'goto-help' && item.url === '/?view=help'));
  }
);

test(
  'help topics are translated in both languages and render in the shared sidebar',
  () => {
    const de = JSON.parse(fs.readFileSync('public/locales/de.json', 'utf8'));
    const en = JSON.parse(fs.readFileSync('public/locales/en.json', 'utf8'));
    assert.equal(renderedText(de['navigation.help']), 'Hilfe');
    assert.equal(renderedText(en['navigation.help']), 'Help');
    // Keep the headline short, with concrete guidance in the help body instead.
    assert.equal(renderedText(de['help.intro']), 'Anleitungen und Antworten zum Whisky Collection Manager.');
    assert.equal(renderedText(en['help.intro']), 'Guides and answers for Whisky Collection Manager.');
    assert.equal(
      renderedText(de['help.description']),
      'Hier findest du Anleitungen zu Abfüllungen, Verkostungsnotizen, Tasting-Flights, Lager, Landkarte, Fotos, Analysen, Backups und Datenspeicherung.'
    );
    assert.equal(
      renderedText(en['help.description']),
      'Find guides for bottlings, tasting notes, tasting flights, storage, maps, photos, analytics, backups and data storage.'
    );
    // Long help text belongs inside the first topic panel, not under the page
    // heading.
    assert.ok(domElements(helpView(), '[class="analytics-page help-page"]').length > 0);
    assert.ok(domElements(helpView(), '[class="section-workspace"]').length > 0);
    assert.ok(domElements(helpView(), '[class="section-nav-desktop"]').length > 0);
    assert.ok(domElements(helpView(), '[data-section-switch="help"]').length > 0);
    assert.ok(domElements(helpView(), '[class="help-description muted"]').length > 0);
    assert.ok(de['help.intro'].length < 75 && en['help.intro'].length < 75);
    assert.ok(domElements(helpView(), '[class="help-description muted"]').length > 0);
    for (const topic of HELP_TOPICS) {
      for (const catalog of [de, en]) {
        assert.ok(catalog[`help.${topic.id}.title`]);
        for (let i = 1; i <= topic.items; i++) assert.ok(catalog[`help.${topic.id}.${i}`]);
      }
    }
    const html = helpView();
    for (const topic of HELP_TOPICS) {
      assert.match(renderedText(html), new RegExp(`data-help-topic="${topic.id}"`));
      assert.match(renderedText(html), new RegExp(`id="help-panel-${topic.id}"`));
      assert.match(renderedText(html), new RegExp(`data-help-topic="${topic.id}"`));
    }
    assert.equal(domElements(html, '[class="help-section"]').length, HELP_TOPICS.length);
    assert.equal(domElements(html, '[class="help-section"][hidden]').length, HELP_TOPICS.length - 1);
    assert.equal(domElements(html, '[class="panel help-section"]').length, 0, 'help articles must not render as cards');
    // Approved layout: the right-hand article alone gets a flat content panel,
    // while its section heading and the left navigation remain outside.
    assert.equal(domElements(html, '[class="help-content-panel"]').length, HELP_TOPICS.length);
    assert.match(
      renderedText(html),
      new RegExp(
        'class="analytics-section-title" id="help-t' + 'itle-basics">[^<]+<\\/h2>\\s*<div class="h' + 'elp-content-panel">'
      )
    );
    assert.ok(domElements(html, '[data-help-topic="basics"][aria-current="page"]').length > 0);
    assert.ok(domElements(html, '[id="help-panel-basics"]').length > 0);
    assert.ok(domElements(html, '[data-act="goto-home"]').length > 0);
  }
);

test(
  'help covers current tasting notes and flights in both languages without old bottling editing advice',
  () => {
    const de = JSON.parse(fs.readFileSync('public/locales/de.json', 'utf8'));
    const en = JSON.parse(fs.readFileSync('public/locales/en.json', 'utf8'));
    const ids = HELP_TOPICS.map(topic => topic.id);
    assert.equal(renderedText(ids).indexOf('tastings'), renderedText(ids).indexOf('bottlings') + 1);
    assert.equal(renderedText(ids).indexOf('flights'), renderedText(ids).indexOf('tastings') + 1);
    for (const catalog of [de, en]) {
      const tasting = Array.from({length: 8}, (_, i) => catalog[`help.tastings.${i + 1}`]).join(' ');
      const flight = Array.from({length: 5}, (_, i) => catalog[`help.flights.${i + 1}`]).join(' ');
      assert.match(renderedText(tasting), /100/);
      assert.match(renderedText(tasting), /20/);
      assert.match(renderedText(flight), /[Dd]rag|Ziehgriff/);
      assert.match(renderedText(flight), /[Oo]ne flight|einem Flight/);
      assert.match(renderedText(flight), /[Dd]elet|Löschen/);
      assert.doesNotMatch(renderedText(catalog['help.bottlings.6']), /directly in the second|direkt im zweiten/);
    }
    const html = helpView('tastings');
    assert.ok(domElements(html, '[id="help-panel-tastings"]').length > 0);
    assert.ok(domElements(html, '[data-help-topic="tastings"][aria-current="page"]').length > 0);
    assert.ok(domElements(helpView('flights'), '[data-help-topic="flights"][aria-current="page"]').length > 0);
    assert.match(renderedText(html), /Glencairn/);
  }
);

test(
  'selecting help topics synchronizes sidebar, selector and visible panel without navigating',
  () => {
    /**
     * Constructs button from the supplied data.
     *
     * @param {*} topic Value used by this operation.
     * @return {!Object} Result computed from the supplied inputs.
     */
    const makeButton = topic => ({
      dataset: {helpTopic: topic.id}, attrs: {},
      classList: {
        active: topic.id === 'basics',
        /**
         * Updates the toggle state for its caller.
         *
         * @param {*} name Environment variable or setting name.
         * @param {*} active Value used by this operation.
         */
        toggle(name, active) {if (name === 'active') this.active = active;},
      },
      /**
       * Updates attribute in the current state.
       *
       * @param {*} name Environment variable or setting name.
       * @param {*} value Value to process.
       */
      setAttribute(name, value) {this.attrs[name] = value;},
      /**
       * Removes or resets attribute.
       *
       * @param {*} name Environment variable or setting name.
       */
      removeAttribute(name) {delete this.attrs[name];},
    });
    const buttons = HELP_TOPICS.map(makeButton);
    const panels = HELP_TOPICS.map(topic => ({id: `help-panel-${topic.id}`, hidden: topic.id !== 'basics'}));
    const selector = {value: 'basics'};
    const container = {
      /**
       * Derives the query selector all result from the supplied values.
       *
       * @param {*} query Search query or filter conditions.
       * @return {!Array<*>} Resulting entries in their output order.
       */
      querySelectorAll(query) {
        return query === '.help-section' ? panels : buttons;
      },
      /**
       * Derives the query selector result from the supplied values.
       *
       * @param {*} query Search query or filter conditions.
       * @return {!Object} Result computed from the supplied inputs.
       */
      querySelector(query) {
        return query === '[data-section-switch="help"]' ? selector : null;
      },
    };
    assert.equal(renderedText(activateHelpTopic('storage', container)), true);
    assert.deepEqual(
      buttons.filter(button => button.classList.active).map(button => button.dataset.helpTopic),
      ['storage']
    );
    assert.equal(renderedText(buttons.find(button => button.dataset.helpTopic === 'storage').attrs['aria-current']), 'page');
    assert.equal(renderedText(buttons.find(button => button.dataset.helpTopic === 'basics').attrs['aria-current']), undefined);
    assert.equal(renderedText(selector.value), 'storage');
    assert.deepEqual(panels.filter(panel => !panel.hidden).map(panel => panel.id), ['help-panel-storage']);
    assert.equal(renderedText(activateHelpTopic('not-a-topic', container)), false);
    assert.equal(renderedText(selector.value), 'storage');
  }
);

test(
  'technical storage paths belong in help documentation rather than a routine screen',
  () => {
    const help = helpView();
    assert.match(renderedText(help), /data\/collection\.json/);
    assert.match(renderedText(help), /data\/warehouse\.json/);
  }
);

test(
  'map legend shows empty catalog sites only when the all-distilleries filter is active',
  () => {
    const omitted = mapLegendHtml(false);
    const included = mapLegendHtml(true);
    assert.doesNotMatch(renderedText(omitted), /map-legend-empty/);
    assert.match(renderedText(included), /map-legend-empty/);
    assert.match(renderedText(included), /map-pagoda-legend/);
  }
);
