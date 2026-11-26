import {domElements, domText, domMatches, domIndex, assertDom} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mapLegendHtml, legendMarkerDiameter} from '../../public/js/views/map.js';
import {initializeLanguage} from '../../public/js/i18n/index.js';

test(
  'map legend explains stocked status before the compact bottle-size scale and clusters',
  async () => {
    const html = mapLegendHtml(false);
    assert.equal((await domElements(html, '.map-legend-section')).length, 3);
    assert.ok(await domIndex(html, '.map-legend-status') < await domIndex(html, '.map-legend-stock'));
    assert.ok(await domIndex(html, '.map-legend-stock') < await domIndex(html, '.map-legend-clusters'));
    assert.match(await domText(html), /Mit Flaschen/);
    await assertDom(html, ".map-legend-status-icon", {text: "1", followingText: "Aktiv"});
    await assertDom(html, ".map-marker-closed.map-legend-status-icon", {text: "1", followingText: "Geschlossen"});
    assert.match(await domText(html), /Flaschenzahl/);
    assert.equal((await domElements(html, '.map-legend-stock-icon')).length, 3);
    for (const n of [1, 10, 100]) {
      await assertDom(html, `.map-legend-stock-icon[style="--legend-diameter:${legendMarkerDiameter(n)}px"]`);
    }
    assert.ok(await domIndex(html, 'span', {text: '1'}) < await domIndex(html, 'span', {text: '10'}));
    assert.ok(await domIndex(html, 'span', {text: '10'}) < await domIndex(html, 'span', {text: '100'}));
    assert.equal((await domElements(html, '.map-cluster-legend-icon'))[0].attributes.style, '--legend-diameter:27px');
    await assertDom(html, ".map-cluster-legend-icon", {text: "6", followingText: "Gruppiert"});
    assert.equal((await domMatches(html, ".map-legend-empty, .map-pagoda-icon")), false);
  }
);

test(
  'both stocked and empty-site legend sections use heading followed by status icons',
  async () => {
    const html = mapLegendHtml(true);
    assert.ok(await domIndex(html, '.map-legend-status') < await domIndex(html, '.map-legend-empty'));
    assert.ok(await domIndex(html, '.map-legend-empty') < await domIndex(html, '.map-legend-stock'));
    await assertDom(html, ".map-legend-heading", {"text": new RegExp("^Ohne Flaschen$")});
    await assertDom(html, ".map-pagoda-legend svg", {followingText: "Aktiv"});
    await assertDom(html, ".map-closed-legend svg", {followingText: "Geschlossen"});
    assert.equal((new RegExp("Aktiv · ohne Flaschen|Geschlossen · ohne Flaschen").test(await domText(html))), false);
    assert.equal((await domElements(html, '.map-pagoda-icon')).length, 2);
    assert.equal((await domElements(html, '.map-legend-stock-icon')).length, 3);
    assert.equal((await domElements(html, '.map-legend-status-icon')).length, 2);
  }
);

test(
  'map legend translates active and closed distillery statuses in English for stocked and empty sites',
  async () => {
    const originalLocation = globalThis.location;
    /**
     * Retrieves locale from the available state.
     *
     * @param {*} url URL of the resource being processed.
     * @return {!Promise<*>} Promise for the asynchronous operation.
     */
    const fetchLocale = async url => ({
      ok: true,
      /**
       * Reads json data from the local filesystem.
       * @return {!Promise<*>} Promise for the asynchronous operation.
       */
      json: async () => JSON.parse(fs.readFileSync(new URL(`../../public${url}`, import.meta.url), 'utf8')),
    });
    try {
      globalThis.location = {search: '?lang=en'};
      assert.equal(await initializeLanguage(fetchLocale), 'en');
      for (const showAll of [false, true]) {
        const html = mapLegendHtml(showAll);
        await assertDom(html, ".map-legend-status-icon", {text: "1", followingText: "Active"});
        await assertDom(html, ".map-marker-closed.map-legend-status-icon", {text: "1", followingText: "Closed"});
        assert.equal((new RegExp("Aktiv|Geschlossen").test(await domText(html))), false);
        if (showAll) {
          await assertDom(html, ".map-pagoda-legend svg", {followingText: "Active"});
          await assertDom(html, ".map-closed-legend svg", {followingText: "Closed"});
        } else {
          await assertDom(html, ".map-legend-empty", {}, true);
        }
      }
    } finally {
      globalThis.location = {search: '?lang=de'};
      await initializeLanguage(fetchLocale);
      if (originalLocation === undefined) delete globalThis.location;
      else globalThis.location = originalLocation;
    }
  }
);
