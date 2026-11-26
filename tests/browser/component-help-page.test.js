import {domElements, domText, assertDom} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HELP_TOPICS, helpView} from '../../public/js/views/help.js';
import {mapLegendHtml} from '../../public/js/views/map.js';

test(
  'help topics are translated in both languages and render in the shared sidebar',
  async () => {
    const de = JSON.parse(fs.readFileSync('public/locales/de.json', 'utf8'));
    const en = JSON.parse(fs.readFileSync('public/locales/en.json', 'utf8'));
    assert.equal(de['navigation.help'], 'Hilfe');
    assert.equal(en['navigation.help'], 'Help');
    // Keep the headline short, with concrete guidance in the help body instead.
    assert.equal(de['help.intro'], 'Anleitungen und Antworten zum Whisky Collection Manager.');
    assert.equal(en['help.intro'], 'Guides and answers for Whisky Collection Manager.');
    assert.equal(
      de['help.description'],
      'Hier findest du Anleitungen zu Abfüllungen, Verkostungsnotizen, Tasting-Flights, Lager, Landkarte, Fotos, Analysen, Backups und Datenspeicherung.'
    );
    assert.equal(
      en['help.description'],
      'Find guides for bottlings, tasting notes, tasting flights, storage, maps, photos, analytics, backups and data storage.'
    );
    // Long help text belongs inside the first topic panel, not under the page
    // heading.
    assert.ok((await domElements(helpView(), '[class="analytics-page help-page"]')).length > 0);
    assert.ok((await domElements(helpView(), '[class="section-workspace"]')).length > 0);
    assert.ok((await domElements(helpView(), '[class="section-nav-desktop"]')).length > 0);
    assert.ok((await domElements(helpView(), '[data-section-switch="help"]')).length > 0);
    assert.ok((await domElements(helpView(), '[class="help-description muted"]')).length > 0);
    assert.ok(de['help.intro'].length < 75 && en['help.intro'].length < 75);
    assert.ok((await domElements(helpView(), '[class="help-description muted"]')).length > 0);
    for (const topic of HELP_TOPICS) {
      for (const catalog of [de, en]) {
        assert.ok(catalog[`help.${topic.id}.title`]);
        for (let i = 1; i <= topic.items; i++) assert.ok(catalog[`help.${topic.id}.${i}`]);
      }
    }
    const html = helpView();
    for (const topic of HELP_TOPICS) {
      await assertDom(html, `[data-help-topic="${topic.id}"]`);
      await assertDom(html, `#help-panel-${topic.id}`);
      await assertDom(html, `[data-help-topic="${topic.id}"]`);
    }
    assert.equal((await domElements(html, '[class="help-section"]')).length, HELP_TOPICS.length);
    assert.equal((await domElements(html, '[class="help-section"][hidden]')).length, HELP_TOPICS.length - 1);
    assert.equal((await domElements(html, '[class="panel help-section"]')).length, 0, 'help articles must not render as cards');
    // Approved layout: the right-hand article alone gets a flat content panel,
    // while its section heading and the left navigation remain outside.
    assert.equal((await domElements(html, '[class="help-content-panel"]')).length, HELP_TOPICS.length);
    await assertDom(html, "h2.analytics-section-title#help-title-basics + div.help-content-panel");
    assert.ok((await domElements(html, '[data-help-topic="basics"][aria-current="page"]')).length > 0);
    assert.ok((await domElements(html, '[id="help-panel-basics"]')).length > 0);
    assert.ok((await domElements(html, '[data-act="goto-home"]')).length > 0);
  }
);

test(
  'help covers current tasting notes and flights in both languages without old bottling editing advice',
  async () => {
    const de = JSON.parse(fs.readFileSync('public/locales/de.json', 'utf8'));
    const en = JSON.parse(fs.readFileSync('public/locales/en.json', 'utf8'));
    const ids = HELP_TOPICS.map(topic => topic.id);
    assert.equal(ids.indexOf('tastings'), ids.indexOf('bottlings') + 1);
    assert.equal(ids.indexOf('flights'), ids.indexOf('tastings') + 1);
    for (const catalog of [de, en]) {
      const tasting = Array.from({length: 8}, (_, i) => catalog[`help.tastings.${i + 1}`]).join(' ');
      const flight = Array.from({length: 5}, (_, i) => catalog[`help.flights.${i + 1}`]).join(' ');
      assert.match(tasting, /100/);
      assert.match(tasting, /20/);
      assert.match(flight, /[Dd]rag|Ziehgriff/);
      assert.match(flight, /[Oo]ne flight|einem Flight/);
      assert.match(flight, /[Dd]elet|Löschen/);
      assert.doesNotMatch(catalog['help.bottlings.6'], /directly in the second|direkt im zweiten/);
    }
    const html = helpView('tastings');
    assert.ok((await domElements(html, '[id="help-panel-tastings"]')).length > 0);
    assert.ok((await domElements(html, '[data-help-topic="tastings"][aria-current="page"]')).length > 0);
    assert.ok((await domElements(helpView('flights'), '[data-help-topic="flights"][aria-current="page"]')).length > 0);
    assert.match(await domText(html), /Glencairn/);
  }
);

test(
  'technical storage paths belong in help documentation rather than a routine screen',
  async () => {
    const help = helpView();
    assert.match(await domText(help), /data\/collection\.json/);
    assert.match(await domText(help), /data\/warehouse\.json/);
  }
);

test(
  'map legend shows empty catalog sites only when the all-distilleries filter is active',
  async () => {
    const omitted = mapLegendHtml(false);
    const included = mapLegendHtml(true);
    await assertDom(omitted, ".map-legend-empty", {}, true);
    await assertDom(included, ".map-legend-empty");
    await assertDom(included, ".map-pagoda-legend");
  }
);
