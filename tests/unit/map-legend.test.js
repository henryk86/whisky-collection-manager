import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mapLegendHtml, legendMarkerDiameter}
  from '../../public/js/views/map.js';
import {markerDiameter} from '../../public/js/domain/distillery-map.js';
import {initializeLanguage} from '../../public/js/i18n/index.js';


test(
  'map legend explains stocked status before the compact bottle-size scale \
and clusters',
  () => {
    const html = mapLegendHtml(false);
    assert.equal((html.match(/class="map-legend-section /g) || []).length, 3);
    assert.ok(html.indexOf('map-legend-status') <
      html.indexOf('map-legend-stock'));
    assert.ok(html.indexOf('map-legend-stock') <
      html.indexOf('map-legend-clusters'));
    assert.match(html, /Mit Flaschen/);
    assert.match(html, /map-legend-status-icon[^>]*>1<\/span>Aktiv/);
    assert.match(
      html,
      /map-marker-closed map-legend-status-icon[^>]*>1<\/span>Geschlossen/
    );
    assert.match(html, /Flaschenzahl/);
    assert.equal((html.match(/map-legend-stock-icon/g) || []).length, 3);
    for (const n of [1, 10, 100]) {
      assert.ok(html.includes(
        `map-legend-stock-icon" style="--legend-diameter:${
legendMarkerDiameter(n)}px"`));
    }
    assert.ok(html.indexOf('>1</span>') < html.indexOf('>10</span>'));
    assert.ok(html.indexOf('>10</span>') < html.indexOf('>100</span>'));
    assert.ok(html.includes(
      `map-cluster-legend-icon" style="--legend-diameter:${27}px"`));
    assert.match(html, />6<\/span>Gruppiert/);
    assert.doesNotMatch(html, /map-legend-empty|map-pagoda-icon/);
  }
);

test(
  'both stocked and empty-site legend sections use heading followed by \
status icons',
  () => {
    const html = mapLegendHtml(true);
    assert.ok(html.indexOf('map-legend-status') <
      html.indexOf('map-legend-empty'));
    assert.ok(html.indexOf('map-legend-empty') <
      html.indexOf('map-legend-stock'));
    assert.match(html, /map-legend-heading\">Ohne Flaschen<\/span>/);
    assert.match(html, /map-pagoda-legend\">[\s\S]*?<\/svg>Aktiv<\/span>/);
    assert.match(
      html,
      /map-closed-legend\">[\s\S]*?<\/svg>Geschlossen<\/span>/
    );
    assert.doesNotMatch(
      html,
      /Aktiv · ohne Flaschen|Geschlossen · ohne Flaschen/
    );
    assert.equal((html.match(/map-pagoda-icon/g) || []).length, 2);
    assert.equal((html.match(/map-legend-stock-icon/g) || []).length, 3);
    assert.equal((html.match(/map-legend-status-icon/g) || []).length, 2);
  }
);

test('legend marker sizes remain compact relative to real map markers', () => {
  assert.deepEqual([1, 10, 100].map(legendMarkerDiameter), [21, 27, 37]);
  assert.ok(legendMarkerDiameter(100) < markerDiameter(100));
});

test(
  'map legend translates active and closed distillery statuses in English \
for stocked and empty sites',
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
      json: async () => JSON.parse(fs.readFileSync(
        new URL(`../../public${url}`, import.meta.url),
        'utf8'
      )),
    });
    try {
      globalThis.location = {search: '?lang=en'};
      assert.equal(await initializeLanguage(fetchLocale), 'en');
      for (const showAll of [false, true]) {
        const html = mapLegendHtml(showAll);
        assert.match(html, /map-legend-status-icon[^>]*>1<\/span>Active/);
        assert.match(
          html,
          /map-marker-closed map-legend-status-icon[^>]*>1<\/span>Closed/
        );
        assert.doesNotMatch(html, /Aktiv|Geschlossen/);
        if (showAll) {
          assert.match(
            html,
            /map-pagoda-legend">[\s\S]*?<\/svg>Active<\/span>/
          );
          assert.match(
            html,
            /map-closed-legend">[\s\S]*?<\/svg>Closed<\/span>/
          );
        } else {
          assert.doesNotMatch(html, /map-legend-empty/);
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
