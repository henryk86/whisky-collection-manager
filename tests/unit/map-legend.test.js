import {renderedText, domElements} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mapLegendHtml, legendMarkerDiameter}
  from '../../public/js/views/map.js';
import {markerDiameter} from '../../public/js/domain/distillery-map.js';
import {initializeLanguage} from '../../public/js/i18n/index.js';


test(
  'map legend explains stocked status before the compact bottle-size scale and clusters',
  () => {
    const html = mapLegendHtml(false);
    assert.equal((renderedText(html).match(/class="map-legend-section /g) || []).length, 3);
    assert.ok(renderedText(html).indexOf('map-legend-status') < renderedText(html).indexOf('map-legend-stock'));
    assert.ok(renderedText(html).indexOf('map-legend-stock') < renderedText(html).indexOf('map-legend-clusters'));
    assert.match(renderedText(html), /Mit Flaschen/);
    assert.match(renderedText(html), /map-legend-status-icon[^>]*>1<\/span>Aktiv/);
    assert.match(renderedText(html), /map-marker-closed map-legend-status-icon[^>]*>1<\/span>Geschlossen/);
    assert.match(renderedText(html), /Flaschenzahl/);
    assert.equal((renderedText(html).match(/map-legend-stock-icon/g) || []).length, 3);
    for (const n of [1, 10, 100]) {
      assert.ok(renderedText(html).includes(`map-legend-stock-icon" style="--legend-diameter:${legendMarkerDiameter(n)}px"`));
    }
    assert.ok(renderedText(html).indexOf('>1</span>') < renderedText(html).indexOf('>10</span>'));
    assert.ok(renderedText(html).indexOf('>10</span>') < renderedText(html).indexOf('>100</span>'));
    assert.equal(domElements(html, '.map-cluster-legend-icon')[0].attributes.style, '--legend-diameter:27px');
    assert.match(renderedText(html), />6<\/span>Gruppiert/);
    assert.doesNotMatch(renderedText(html), /map-legend-empty|map-pagoda-icon/);
  }
);

test(
  'both stocked and empty-site legend sections use heading followed by status icons',
  () => {
    const html = mapLegendHtml(true);
    assert.ok(renderedText(html).indexOf('map-legend-status') < renderedText(html).indexOf('map-legend-empty'));
    assert.ok(renderedText(html).indexOf('map-legend-empty') < renderedText(html).indexOf('map-legend-stock'));
    assert.match(renderedText(html), /map-legend-heading\">Ohne Flaschen<\/span>/);
    assert.match(renderedText(html), /map-pagoda-legend\">[\s\S]*?<\/svg>Aktiv<\/span>/);
    assert.match(renderedText(html), /map-closed-legend\">[\s\S]*?<\/svg>Geschlossen<\/span>/);
    assert.doesNotMatch(renderedText(html), /Aktiv · ohne Flaschen|Geschlossen · ohne Flaschen/);
    assert.equal((renderedText(html).match(/map-pagoda-icon/g) || []).length, 2);
    assert.equal((renderedText(html).match(/map-legend-stock-icon/g) || []).length, 3);
    assert.equal((renderedText(html).match(/map-legend-status-icon/g) || []).length, 2);
  }
);

test('legend marker sizes remain compact relative to real map markers', () => {
  assert.deepEqual([1, 10, 100].map(legendMarkerDiameter), [21, 27, 37]);
  assert.ok(legendMarkerDiameter(100) < markerDiameter(100));
});

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
      assert.equal(renderedText(await initializeLanguage(fetchLocale)), 'en');
      for (const showAll of [false, true]) {
        const html = mapLegendHtml(showAll);
        assert.match(renderedText(html), /map-legend-status-icon[^>]*>1<\/span>Active/);
        assert.match(renderedText(html), /map-marker-closed map-legend-status-icon[^>]*>1<\/span>Closed/);
        assert.doesNotMatch(renderedText(html), /Aktiv|Geschlossen/);
        if (showAll) {
          assert.match(renderedText(html), /map-pagoda-legend">[\s\S]*?<\/svg>Active<\/span>/);
          assert.match(renderedText(html), /map-closed-legend">[\s\S]*?<\/svg>Closed<\/span>/);
        } else {
          assert.doesNotMatch(renderedText(html), /map-legend-empty/);
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
