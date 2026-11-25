import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HELP_TOPICS} from '../../public/js/views/help.js';
import {startTestServer, requestJson} from '../helpers/server.js';
import {
  domOnly, chromium, session, openSettingsFromMenu, openSettingsSection,
  seed, mockDecoder
} from './support.js';
test(
  'browser: map and collection use the same full-width content frame, right \
drawer and unified return button',
  async () => {
    await session(async ({page, open}) => {
      await open();
      await page.locator('.collection-hero').waitFor({state: 'visible'});
      for (const width of [320, 390, 740, 1024, 1366, 1660]) {
        await page.setViewportSize({width, height: 900});
        const homeFrame = await page.evaluate(() => {
          const main = document.querySelector('main').getBoundingClientRect();
          const hero = document.querySelector('.collection-hero')
            .getBoundingClientRect();
          return {
            left: main.left, right: main.right, width: main.width,
            viewportContentWidth: document.body.getBoundingClientRect().width,
            contentLeft: hero.left, contentRight: hero.right,
            overflow: document.body.scrollWidth - document.body
              .getBoundingClientRect().width,
          };
        });
        // The root's clientWidth can still include the reserved scrollbar track
        // while the body's layout box excludes it. Measure that actual
        // layout box: it is what main { width: 100% } fills.
        assert.ok(
          Math.abs(homeFrame.width -
            Math.min(homeFrame.viewportContentWidth, 1350)) <= 1,
          `${width}px: collection main should fill usable width ${homeFrame
            .viewportContentWidth}, got ${homeFrame.width}`
        );
        assert.ok(
          homeFrame.viewportContentWidth <= width &&
          homeFrame.viewportContentWidth > 0,
          `${width}px: browser content viewport should fit within the window`
        );
        assert.ok(
          homeFrame.overflow <= 1,
          `${width}px: collection must not overflow`
        );

        await page.locator('#menu-button').click();
        const drawer = await page.locator('#site-drawer').evaluate(el => {
          const rect = el.getBoundingClientRect();
          const backdrop = document.querySelector('.site-drawer-backdrop')
            .getBoundingClientRect();
          return {
            left: rect.left,
            right: rect.right,
            width: rect.width,
            backdropRight: backdrop.right,
            layoutRight: document.body.getBoundingClientRect().right,
          };
        });
        // A fixed element can end at the gutter boundary, not innerWidth.
        // It must align with its backdrop and remain at the usable right edge.
        assert.ok(Math.abs(drawer.right - drawer.backdropRight) <= 1,
          `${width}px: menu drawer must align with fixed backdrop right \
edge: ${JSON.stringify(drawer)}`);
        assert.ok(
          drawer.right >= drawer.layoutRight - 1 && drawer.right <= width + 1,
          `${width}px: menu drawer must stay on the right, including the \
scrollbar gutter: ${JSON.stringify(drawer)}`
        );
        assert.ok(
          drawer.left >= -1,
          `${width}px: drawer must remain inside viewport`
        );
        assert.equal(
          await page.locator('#menu-button').getAttribute('aria-expanded'),
          'true'
        );
        await page.locator('#site-drawer [data-act="goto-map"]').click();
        await page.locator('.map-layout').waitFor({state: 'visible'});
        assert.equal(await page.locator('#site-drawer').isVisible(), false);

        const mapFrame = await page.evaluate(() => {
          const main = document.querySelector('main').getBoundingClientRect();
          const layout = document.querySelector('.map-layout')
            .getBoundingClientRect();
          const map = document.querySelector('.map-stage')
            .getBoundingClientRect();
          const sidebar = document.querySelector('.map-sidebar')
            .getBoundingClientRect();
          const actualGridColumns =
            getComputedStyle(document.querySelector('.map-layout'))
              .gridTemplateColumns.split(' ').length;
          return {
            left: main.left,
            right: main.right,
            width: main.width,
            contentLeft: layout.left,
            contentRight: layout.right,
            mapRight: map.right,
            sidebarLeft: sidebar.left,
            sidebarRight: sidebar.right,
            mapTop: map.top,
            sidebarTop: sidebar.top,
            actualGridColumns,
            overflow: document.body.scrollWidth - document.body
              .getBoundingClientRect().width,
          };
        });
        for (const field of ['left', 'right', 'width']) {
          assert.ok(Math.abs(mapFrame[field] - homeFrame[field]) <= 1,
            `${width}px: map and collection ${field} differ: ${mapFrame[
            field]} vs ${homeFrame[field]}`);
        }
        assert.ok(Math.abs(mapFrame.contentLeft - homeFrame.contentLeft) <= 1,
          `${width}px: map content must align with collection content left \
edge`);
        assert.ok(Math.abs(mapFrame.contentRight - homeFrame.contentRight) <= 1,
          `${width}px: map content must align with collection content right \
edge`);
        if (width > 950) {
          assert.equal(
            mapFrame.actualGridColumns,
            2,
            `${width}px: preserve two-column map layout`
          );
          assert.ok(
            mapFrame.mapRight + 5 < mapFrame.sidebarLeft,
            `${width}px: separate map and sidebar`
          );
          assert.ok(Math.abs(mapFrame.mapTop - mapFrame.sidebarTop) <= 1,
            `${width}px: the map and info panel remain side by side`);
          assert.ok(Math.abs(mapFrame.sidebarRight -
            mapFrame.contentRight) <= 1);
        } else {
          assert.equal(
            mapFrame.actualGridColumns,
            1,
            `${width}px: stack the layout on smaller displays`
          );
        }
        assert.ok(mapFrame.overflow <= 1, `${width}px: map must not overflow`);
        const mapBack = page.locator(
          'main .section-head .ds-back-button--page-action');
        assert.equal(await mapBack.innerText(), 'Zur Sammlung');
        assert.equal(await mapBack.getAttribute('data-act'), 'goto-home');
        await mapBack.click();
        await page.locator('.collection-hero').waitFor({state: 'visible'});
      }
      await page.locator('#menu-button').click();
      await page.locator('#site-drawer [data-act="goto-settings-menu"]')
        .click();
      await page.getByRole('heading', {name: 'Einstellungen & Datensicherung'})
        .waitFor();
      const settingsBack =
        page.locator('main .section-head .ds-back-button--page-action');
      assert.equal(await settingsBack.innerText(), 'Zur Sammlung');
      assert.equal(await settingsBack.getAttribute('data-act'), 'goto-home');
      await settingsBack.click();
      await page.locator('.collection-hero').waitFor({state: 'visible'});
    });
  }
);



test(
  'browser: map can toggle every catalogued distillery and show pagoda \
markers for empty sites',
  async () => {
    await session(async ({page, open, base}) => {
      const catalog = (await requestJson(base, '/api/collection')).data
        .distilleries;
      const kilchoman = catalog.find(site => site.name === 'Kilchoman');
      const aberfeldy = catalog.find(site => site.name === 'Aberfeldy');
      assert.ok(kilchoman && aberfeldy);
      const added = await requestJson(base, '/api/bottlings', 'POST', {
        name: 'Only Kilchoman', distilleryIds: [kilchoman.id],
        firstBottle: {inventoryNumber: '088601', status: 'closed'},
      });
      assert.equal(added.status, 201);
      await open();
      await page.locator('[data-act="toggle-menu"]').click();
      await page.locator('#site-drawer [data-act="goto-map"]').click();
      const toggle = page.getByRole('switch',
        {name: 'Alle Destillerien anzeigen'});
      assert.equal(await toggle.isChecked(), false);
      assert.equal(await page.locator('#map-site-select option').count(), 1);
      assert.equal(await page.locator('.map-marker-pagoda').count(), 0);
      assert.equal(await page.locator('.map-marker').count(), 1);
      assert.equal(
        await page.locator('.map-zoom-level').innerText(),
        'Zoom 11'
      );
      const originalCamera = await page.locator('.map-tiles img').first()
        .evaluate(img => ({
          tile: img.getAttribute('src'),
          left: img.style.left,
          top: img.style.top,
        }));

      await toggle.check();
      assert.equal(
        await page.locator('#map-site-select option').count(),
        catalog.length
      );
      // Toggling all distilleries must NOT reset zoom or recenter the map.
      assert.equal(
        await page.locator('.map-zoom-level').innerText(),
        'Zoom 11'
      );
      assert.deepEqual(
        await page.locator('.map-tiles img').first().evaluate(img => ({
          tile: img.getAttribute('src'),
          left: img.style.left,
          top: img.style.top,
        })),
        originalCamera,
        'toggle preserves the original map position'
      );
      // The overview is a separate, intentional user action; only then can
      // worldwide pagoda markers and clusters be expected in the viewport.
      await page.getByRole('button', {name: 'Alle Standorte anzeigen'}).click();
      // At world scale, every unstocked site can be part of a cluster.
      // The selected empty distillery is checked for an individual pagoda
      // below.
      assert.equal(
        await page.locator('.map-legend .map-pagoda-icon').count(),
        2,
        'active and closed distilleries have distinct legend icons'
      );
      assert.ok(
        await page.locator('.map-marker-cluster').count() > 0,
        'all-sites overview must cluster nearby distilleries'
      );
      assert.ok((await page.locator('.map-legend').innerText())
        .includes('Gruppiert'));
      assert.match(
        await page.locator('.map-legend-empty').innerText(),
        /^Ohne Flaschen\s+Aktiv\s+Geschlossen$/
      );
      const clusterLegend =
        page.locator('.map-legend .map-cluster-legend-icon.map-cluster-visual');
      assert.equal(
        await clusterLegend.count(),
        1,
        'legend must reuse the actual cluster appearance'
      );
      assert.equal(
        await clusterLegend.innerText(),
        '6',
        'legend example shows a group, not a single distillery'
      );
      assert.equal(
        await page.locator(
          '.map-markers .map-marker-cluster.map-cluster-visual').count() > 0,
        true
      );
      assert.equal(
        await clusterLegend.evaluate(el => getComputedStyle(el)
          .backgroundColor),
        await page.locator(
          '.map-markers .map-marker-cluster.map-cluster-visual:not(.selected)')
          .first()
          .evaluate(el => getComputedStyle(el).backgroundColor),
        'cluster and legend icon use the same cluster background'
      );
      const legendSections = await page.locator('.map-legend-section')
        .evaluateAll(nodes => nodes.map(node => node.classList[1]));
      assert.deepEqual(
        legendSections,
        [
          'map-legend-status',
          'map-legend-empty',
          'map-legend-stock',
          'map-legend-clusters',
        ],
        'both status sections are adjacent, followed by the size scale and \
groups'
      );
      assert.equal(
        await page.locator('.map-legend .map-legend-status-icon').count(),
        2,
        'stocked active and closed sites have distinct legend symbols'
      );
      assert.equal(
        await page.locator(
          '.map-legend .map-legend-status-icon.map-marker-closed').count(),
        1,
        'closed stocked marker uses the dashed closed marker class'
      );
      const stockLegend = page.locator('.map-legend .map-legend-stock-icon');
      assert.equal(
        await stockLegend.count(),
        3,
        'only the three stock size samples 1, 10, 100 are shown'
      );
      const sampleSizes = await stockLegend.evaluateAll(nodes =>
        nodes.map(node => Math.round(node.getBoundingClientRect().width)));
      assert.deepEqual(
        sampleSizes,
        [21, 27, 37],
        'legend samples use compact proportional diameters'
      );
      assert.equal(Math.round((await clusterLegend.boundingBox()).width), 27,
        'group sample should remain compact while live groups keep their \
map sizes');
      assert.deepEqual(await stockLegend.allInnerTexts(), ['1', '10', '100'],
        'bottle counts are displayed inside their markers, as on the map');
      // At the worldwide overview zoom, even the sole stocked distillery can
      // be inside a cluster with unstocked sites. Do not require a separate
      // stocked marker until we explicitly focus that distillery below.
      for (const theme of ['light', 'dark']) {
        await page.evaluate(
          value => document.documentElement.setAttribute('data-theme', value),
          theme
        );
        const legendStyle = await clusterLegend.evaluate(el => ({
          background: getComputedStyle(el).backgroundColor,
          border: getComputedStyle(el).borderTopColor,
          color: getComputedStyle(el).color,
        }));
        const markerStyle =
          await page.locator('.map-markers .map-marker-cluster:not(.selected)')
            .first().evaluate(el => ({
              background: getComputedStyle(el).backgroundColor,
              border: getComputedStyle(el).borderTopColor,
              color: getComputedStyle(el).color,
            }));
        assert.deepEqual(
          legendStyle,
          markerStyle,
          `cluster icon must match the map marker in ${theme} mode`
        );
        const clusterGeometry = await clusterLegend.evaluate(el => ({
          radius: getComputedStyle(el).borderRadius,
          shape: getComputedStyle(el).clipPath,
        }));
        const liveClusterGeometry =
          await page.locator('.map-markers .map-marker-cluster:not(.selected)')
            .first().evaluate(el => ({
              radius: getComputedStyle(el).borderRadius,
              shape: getComputedStyle(el).clipPath,
            }));
        assert.deepEqual(
          clusterGeometry,
          {radius: '50%', shape: 'none'},
          'cluster sample must be round'
        );
        assert.deepEqual(
          clusterGeometry,
          liveClusterGeometry,
          `round cluster appearance matches in ${theme} mode`
        );
        const statusStyles = await page.locator('.map-legend-status-icon')
          .evaluateAll(nodes => nodes.map(el => ({
            background: getComputedStyle(el).backgroundColor,
            border: getComputedStyle(el).borderTopColor,
            borderStyle: getComputedStyle(el).borderTopStyle,
          })));
        const liveStock = await page.evaluate(() => {
          // The only stocked map marker may be selected, so compare against
          // an unselected live-style reference rather than selection gold.
          const marker = document.createElement('span');
          marker.className = 'map-marker map-stock-visual';
          document.body.append(marker);
          const style = getComputedStyle(marker);
          const result = {
            background: style.backgroundColor,
            border: style.borderTopColor,
            borderStyle: style.borderTopStyle,
          };
          marker.remove();
          return result;
        });
        assert.deepEqual(
          statusStyles[0],
          liveStock,
          `active stocked legend uses live marker style in ${theme} mode`
        );
        assert.equal(
          statusStyles[1].borderStyle,
          'dashed',
          `closed stocked legend shows dashed outline in ${theme} mode`
        );
        assert.notEqual(statusStyles[0].background, statusStyles[1].background,
          `closed and active stocked markers are distinguishable in ${
theme} mode`);
        for (const legendIcon of await page.locator(
          '.map-legend .map-legend-marker, .map-legend .map-pagoda-icon').all(
        )) {
          const decoration = await legendIcon.evaluate(el => ({
            boxShadow: getComputedStyle(el).boxShadow,
            filter: getComputedStyle(el).filter,
            textShadow: getComputedStyle(el).textShadow,
          }));
          assert.deepEqual(
            decoration,
            {boxShadow: 'none', filter: 'none', textShadow: 'none'},
            `legend example has no glow or shadow in ${theme} mode`
          );
        }
      }
      await page.evaluate(() => document.documentElement
        .setAttribute('data-theme', 'light'));
      assert.ok(
        await page.locator('#map-site-select option').count() ===
        catalog.length,
        'all sites stay individually selectable'
      );
      const allZoom = Number((await page.locator('.map-zoom-level')
        .innerText()).replace('Zoom ',
          ''
        ));
      assert.ok(
        allZoom < 11,
        'explicitly fitting all locations should zoom out to the wider \
geographic area'
      );
      await page.locator('#map-site-select').selectOption(aberfeldy.id);
      const emptyMarker =
        page.locator('.map-marker-pagoda[aria-label^="Aberfeldy:"]');
      await emptyMarker.waitFor({state: 'visible'});
      assert.equal(await emptyMarker.locator('.map-pagoda-icon').count(), 1,
        'focusing an empty distillery reveals its pagoda marker, even if \
the overview showed only clusters');
      assert.match(
        await page.locator('.map-site-heading').innerText(),
        /0 Abfüllungen · 0 Flaschen/
      );
      assert.equal(await page.locator('.map-empty-site').isVisible(), true);
      assert.equal(await page.locator('#map-bottling-search').count(), 0);
      await emptyMarker.click();
      assert.equal(
        await page.locator('#map-site-select').inputValue(),
        aberfeldy.id
      );

      // A focused stocked distillery must be shown as an individual marker,
      // even if it was previously aggregated in a worldwide overview.
      await page.locator('#map-site-select').selectOption(kilchoman.id);
      const stockedMarker =
        page.locator(
          '.map-markers .map-marker.map-stock-visual[aria-label^="Kilchoman:"]'
        );
      await stockedMarker.waitFor({state: 'visible'});
      assert.match(
        await stockedMarker.getAttribute('aria-label'),
        /1 Flaschen/
      );

      await page.setViewportSize({width: 390, height: 820});
      assert.equal(
        await page.getByRole('switch', {name: 'Alle Destillerien anzeigen'})
          .isVisible(),
        true
      );
      const overflow = await page.evaluate(() => document.body.scrollWidth -
        document.body.getBoundingClientRect().width);
      assert.ok(
        overflow <= 1,
        `mobile map layer causes overflow: ${overflow}px`
      );

      const focusedZoom = await page.locator('.map-zoom-level').innerText();
      await page.getByRole('switch', {name: 'Alle Destillerien anzeigen'})
        .uncheck();
      assert.equal(await page.locator('#map-site-select option').count(), 1);
      assert.equal(await page.locator('.map-marker-pagoda').count(), 0);
      assert.equal(
        await page.locator('.map-marker[aria-label^="Kilchoman:"]').count(),
        1
      );
      assert.equal(
        await page.locator('.map-zoom-level').innerText(),
        focusedZoom,
        'hiding the full catalog also preserves the current zoom'
      );
    });
  }
);



test(
  'browser: zoom-dependent clusters expand on click while keeping the \
underlying distillery records',
  async () => {
    await session(async ({page, open, base}) => {
      const list = (await requestJson(base, '/api/collection')).data
        .distilleries;
      const ardbeg = list.find(site => site.name === 'Ardbeg');
      const lagavulin = list.find(site => site.name === 'Lagavulin');
      assert.ok(ardbeg && lagavulin);
      for (const [site, inventory] of [[ardbeg, '088711'], [lagavulin,
        '088712']]) {
        const added = await requestJson(base, '/api/bottlings', 'POST', {
          name: `Cluster ${site.name}`, distilleryIds: [site.id],
          firstBottle: {inventoryNumber: inventory, status: 'closed'},
        });
        assert.equal(added.status, 201);
        if (site.id === ardbeg.id) {
          for (const inventoryNumber of ['088713', '088714']) {
            const extra = await requestJson(base, '/api/bottles', 'POST', {
              bottlingId: added.data.bottling.id,
              inventoryNumber,
              status: 'closed',
            });
            assert.equal(extra.status, 201);
          }
        }
      }
      await open();
      await page.locator('[data-act="toggle-menu"]').click();
      await page.locator('#site-drawer [data-act="goto-map"]').click();
      assert.equal(await page.locator('#map-site-select option').count(), 2);
      const zoomOut = page.getByRole('button', {name: 'Karte verkleinern'});
      for (let i = 0; i < 12 && await page.locator('.map-marker-cluster')
        .count() === 0; i++) await zoomOut.click();
      const cluster = page.locator('.map-marker-cluster');
      await cluster.waitFor({state: 'visible'});
      assert.equal(
        await cluster.innerText(),
        '4',
        'cluster marker sums three Ardbeg and one Lagavulin bottles'
      );
      assert.match(
        await cluster.getAttribute('aria-label'),
        /4 Flaschen · 2 Destillerien/
      );
      const initialZoom = Number((await page.locator('.map-zoom-level')
        .innerText()).replace('Zoom ',
          ''
        ));
      await cluster.click();
      const nextZoom = Number((await page.locator('.map-zoom-level')
        .innerText()).replace('Zoom ',
          ''
        ));
      assert.equal(
        nextZoom,
        Math.min(initialZoom + 2, 16),
        'clicking a group zooms towards it'
      );
      const zoomIn = page.getByRole('button', {name: 'Karte vergrößern'});
      for (let i = nextZoom; i < 16; i++) await zoomIn.click();
      assert.equal(
        await page.locator('.map-marker-cluster').count(),
        0,
        'no clusters may remain at maximum zoom'
      );
      assert.equal(await page.locator('#map-site-select option').count(), 2);
      await page.locator('#map-site-select').selectOption(lagavulin.id);
      assert.match(
        await page.locator('.map-site-heading').innerText(),
        /Lagavulin/
      );
      assert.equal(
        await page.locator('.map-marker[aria-label^="Lagavulin:"]').count(),
        1,
        'selecting a distillery must still expose its individual marker'
      );
    });
  }
);



test(
  'browser: map menu, location-based aggregation, responsive fit and detail \
link',
  async () => {
    await session(async ({page, open, base}) => {
      const list = (await requestJson(base, '/api/collection')).data
        .distilleries;
      const kilchoman = list.find(d => d.name === 'Kilchoman');
      const ardbeg = list.find(d => d.name === 'Ardbeg');
      assert.ok(kilchoman && ardbeg);
      for (const [name, id, count] of [
        ['Map Kilchoman A', kilchoman.id, 3],
        ['Map Kilchoman B', kilchoman.id, 1],
        ['Map Ardbeg', ardbeg.id, 1],
      ]) {
        const response = await requestJson(base, '/api/bottlings', 'POST', {
          name, distilleryIds: [id],
          ...(name === 'Map Kilchoman A' ?
            {
              ageYears: 8,
              abv: 46.2,
              distillationYear: 2012,
              bottlingYear: 2020,
            } : {}),
          firstBottle: {
            inventoryNumber: String(800 + count + name.length),
            status: 'closed',
          },
        });
        assert.equal(response.status, 201);
        for (let i = 1; i < count; i++) {
          const extra = await requestJson(
            base,
            '/api/bottles',
            'POST',
            {
              bottlingId: response.data.bottling.id,
              inventoryNumber: `${name.length}${i}99`,
              status: 'closed',
            }
          );
          assert.equal(extra.status, 201);
        }
      }
      await page.setViewportSize({width: 390, height: 820});
      await open();
      await page.locator('[data-act="toggle-menu"]').click();
      assert.equal(await page.locator('#site-drawer').isVisible(), true);
      await page.locator('#site-drawer [data-act="goto-map"]').click();
      await page.locator('.map-marker').first().waitFor({state: 'visible'});
      assert.equal(await page.locator('#site-drawer').isVisible(), false);
      assert.equal(await page.locator('.map-marker').count(), 2);
      const marker = page.locator('.map-marker[aria-label^="Kilchoman:"]');
      assert.match(
        await marker.getAttribute('aria-label'),
        /2 Abfüllungen, 4 Flaschen/
      );
      assert.match(
        await page.locator('.map-zoom-level').innerText(),
        /Zoom (?:8|9|10|11|12)/
      );
      assert.equal(await page.locator('.map-attribution').isVisible(), true);
      await page.locator('#map-site-select').selectOption(kilchoman.id);
      assert.equal(
        await page.locator('.map-position-edit .action-icon').count(),
        1
      );
      const editRect = await page.locator('.map-site-title').evaluate(el => {
        const name = el.querySelector('strong').getBoundingClientRect();
        const button = el.querySelector('button').getBoundingClientRect();
        return {
          nameRight: name.right,
          buttonLeft: button.left,
          nameTop: name.top,
          buttonTop: button.top,
          buttonWidth: button.width,
        };
      });
      assert.ok(editRect.buttonLeft > editRect.nameRight - 1 &&
        editRect.buttonWidth <= 36);
      assert.ok(Math.abs(editRect.buttonTop - editRect.nameTop) < 15);
      assert.equal(
        await page.locator('.map-missing').count(),
        0,
        'hide missing section when all map sites are located'
      );
      assert.doesNotMatch(
        await page.locator('.map-summary').innerText(),
        /ohne Standort/
      );
      assert.doesNotMatch(
        await page.locator('.map-legend').innerText(),
        /62 px/
      );
      await page.locator('.map-position-edit').click();
      assert.equal(
        await page.locator('#distillery-latitude').inputValue(),
        '55.7869',
        'catalog location must prefill edit dialog'
      );
      await page.locator('[data-act="close-modal"]').last().click();
      assert.equal(await page.locator('.map-bottling-link').count(), 2);
      const annotated = page.locator('.map-bottling-link')
        .filter({hasText: 'Map Kilchoman A'});
      assert.equal(
        await annotated.locator('.map-bottling-facts').innerText(),
        '8 Jahre · 46,2 % Vol. · Dest. 2012 · Abgef. 2020'
      );
      assert.match(await annotated.innerText(), /3 Flaschen/);
      assert.equal(
        await page.locator('.map-bottling-facts').count(),
        1,
        'missing metadata does not render empty placeholder'
      );
      await page.locator('#map-bottling-search').fill('Kilchoman B');
      assert.equal(await page.locator('.map-bottling-link').count(), 1);
      await page.locator('.map-bottling-link').first().click();
      await page.locator('[data-act="edit-bottling"]')
        .waitFor({state: 'visible'});
      assert.match(
        await page.locator('.section-head h2').first().innerText(),
        /Map Kilchoman B/
      );
      await page.locator('[data-act="toggle-menu"]').click();
      await page.locator('#site-drawer [data-act="goto-map"]').click();
      await page.locator('[data-map-control="fit"]').click();
      assert.equal(await page.locator('.map-marker').count(), 2);
      const overflow = await page.evaluate(() => document.body.scrollWidth -
        document.body.getBoundingClientRect().width);
      assert.ok(overflow <= 1, `mobile horizontal overflow: ${overflow}px`);
    });
  }
);



test(
  'browser: unknown distillery can be positioned in app and large per-site \
list is paginated',
  async () => {
    await session(async ({page, open, base}) => {
      const added = await requestJson(
        base,
        '/api/distilleries',
        'POST',
        {name: 'Private Test Destillery'}
      );
      assert.equal(added.status, 201);
      for (let i = 0; i < 15; i++) {
        const response = await requestJson(base, '/api/bottlings', 'POST', {
          name: `Unlocated Whisky ${String(i).padStart(2, '0')}`,
          distilleryIds: [added.data.id],
          firstBottle: {inventoryNumber: String(90500 + i), status: 'closed'},
        });
        assert.equal(response.status, 201);
      }
      await open();
      await page.locator('[data-act="toggle-menu"]').click();
      await page.locator('#site-drawer [data-act="goto-map"]').click();
      if (!(await page.locator('.map-missing').evaluate(details =>
        details.open))) await page.locator('.map-missing summary').click();
      const edit = page.locator(`[data-map-edit="${added.data.id}"]`).first();
      await edit.click();
      await page.locator('#distillery-latitude').fill('55.7869');
      await page.locator('#distillery-longitude').fill('-6.4308');
      await page.locator('#distillery-form button[type="submit"]').click();
      await page.locator('.overlay').waitFor({state: 'detached'});
      assert.equal(
        (await requestJson(base, '/api/collection')).data.distilleries
          .find(d => d.id === added.data.id).latitude,
        55.7869
      );
      const marker = page.locator(
        '.map-marker[aria-label^="Private Test Destillery:"]');
      await marker.waitFor({state: 'visible'});
      await page.locator('#map-site-select').selectOption(added.data.id);
      assert.equal(await page.locator('.map-bottling-link').count(), 12);
      await page.locator('[data-map-page="next"]').click();
      assert.equal(await page.locator('.map-bottling-link').count(), 3);
      assert.match(
        await page.locator('.map-list-pager').innerText(),
        /Seite 2 von 2/
      );
    });
  }
);




test(
  'browser: editing map coordinates keeps zoom and recenters only after a \
position change',
  async () => {
    await session(async ({page, open, base}) => {
      const distilleries = (await requestJson(base, '/api/collection')).data
        .distilleries;
      const ardbeg = distilleries.find(site => site.name === 'Ardbeg');
      const kilchoman = distilleries.find(site => site.name === 'Kilchoman');
      assert.ok(ardbeg && kilchoman);
      for (const [distillery, number] of [[ardbeg, '071411'], [kilchoman,
        '071412']]) {
        const created = await requestJson(base, '/api/bottlings', 'POST', {
          name: `Map position edit ${distillery.name}`,
          distilleryIds: [distillery.id],
          firstBottle: {inventoryNumber: number, status: 'closed'},
        });
        assert.equal(created.status, 201);
      }
      await open();
      await page.locator('[data-act="toggle-menu"]').click();
      await page.locator('#site-drawer [data-act="goto-map"]').click();
      await page.locator('#map-site-select').selectOption(ardbeg.id);
      await page.locator('[data-map-control="in"]').click();
      await page.locator('[data-map-control="in"]').click();
      const zoomBefore = await page.locator('.map-zoom-level').innerText();
      assert.ok(Number(zoomBefore.replace('Zoom ', '')) >= 12);

      await page.locator('.map-position-edit').click();
      await page.locator('#distillery-latitude').fill('55.7101');
      await page.locator('#distillery-longitude').fill('-6.2202');
      await page.locator('#distillery-form button[type="submit"]').click();
      await page.locator('.overlay').waitFor({state: 'detached'});
      assert.equal(
        await page.locator('.map-zoom-level').innerText(),
        zoomBefore,
        'saving an edited location must never refit all map points'
      );
      assert.equal(
        await page.locator('#map-site-select').inputValue(),
        ardbeg.id
      );
      const marker = page.locator('.map-marker[aria-label^="Ardbeg:"]');
      const position = await marker.evaluate(element => {
        const marker = element.getBoundingClientRect();
        const view = document.querySelector('.map-viewport')
          .getBoundingClientRect();
        return {
          x: marker.left + marker.width / 2 - view.left - view.width / 2,
          y: marker.top + marker.height / 2 - view.top - view.height / 2,
        };
      });
      assert.ok(Math.abs(position.x) < 3 && Math.abs(position.y) < 3,
        `corrected location should be centered at the original zoom: ${JSON
          .stringify(position)}`);
      assert.equal(
        (await requestJson(base, '/api/collection')).data.distilleries
          .find(site => site.id === ardbeg.id).latitude,
        55.7101
      );

      // A metadata-only edit must not shift the map, and must preserve zoom.
      // Retain the same DOM node; rebuilding the viewer can lose the exact
      // camera.
      await page.locator('#distillery-map')
        .evaluate(element => {element.dataset.cameraIdentity = 'keep';});
      await page.locator('[data-map-control="out"]').click();
      const zoomAfterOut = await page.locator('.map-zoom-level').innerText();
      const viewport = await page.locator('.map-viewport').boundingBox();
      await page.mouse.move(
        viewport.x + viewport.width / 2 + 110,
        viewport.y + viewport.height / 2 + 65
      );
      await page.mouse.down();
      await page.mouse.move(
        viewport.x + viewport.width / 2 + 165,
        viewport.y + viewport.height / 2 + 90,
        {steps: 5}
      );
      await page.mouse.up();
      const displaced = await page.locator('.map-marker[aria-label^="Ardbeg:"]'
      ).evaluate(element => {
        const marker = element.getBoundingClientRect();
        const view = document.querySelector('.map-viewport')
          .getBoundingClientRect();
        return {
          x: marker.left + marker.width / 2 - view.left - view.width / 2,
          y: marker.top + marker.height / 2 - view.top - view.height / 2,
        };
      });
      assert.ok(
        Math.abs(displaced.x) > 25,
        'dragging should move the marker away from center'
      );
      await page.locator('.map-position-edit').click();
      await page.locator('#distillery-status').selectOption('closed');
      await page.locator('#distillery-form button[type="submit"]').click();
      await page.locator('.overlay').waitFor({state: 'detached'});
      assert.equal(
        await page.locator('.map-zoom-level').innerText(),
        zoomAfterOut
      );
      assert.equal(
        await page.locator('#distillery-map')
          .getAttribute('data-camera-identity'),
        'keep',
        'a metadata edit should update map markers without remounting the \
map viewer'
      );
      assert.equal(
        await page.locator('#map-site-select').inputValue(),
        ardbeg.id
      );
      const samePosition =
        await page.locator('.map-marker[aria-label^="Ardbeg:"]')
          .evaluate(element => {
            const marker = element.getBoundingClientRect();
            const view = document.querySelector('.map-viewport')
              .getBoundingClientRect();
            return {
              x: marker.left + marker.width / 2 - view.left - view.width / 2,
              y: marker.top + marker.height / 2 - view.top - view.height / 2,
            };
          });
      assert.ok(
        Math.abs(samePosition.x - displaced.x) < 3 &&
        Math.abs(samePosition.y - displaced.y) < 3,
        'a status-only edit must preserve the panned map center'
      );
    });
  }
);



test(
  'browser: OSM tiles switch theme and wheel zoom holds cursor geography',
  async () => {
    await session(async ({page, base, open}) => {
      const catalog = (await requestJson(base, '/api/collection')).data
        .distilleries;
      for (const [name, number] of [['Kilchoman', '071301'], ['Ardbeg',
        '071302']]) {
        const distillery = catalog.find(site => site.name === name);
        assert.ok(distillery, `${name} should be in the catalog`);
        const added = await requestJson(base, '/api/bottlings', 'POST', {
          name: `Wheel test ${name}`,
          distilleryIds: [distillery.id],
          firstBottle: {inventoryNumber: number, status: 'closed'},
        });
        assert.equal(added.status, 201);
      }
      await open();
      await page.locator('[data-act="toggle-menu"]').click();
      await page.locator('#site-drawer [data-act="goto-map"]').click();
      const marker = page.locator('.map-marker[aria-label^="Kilchoman:"]');
      await marker.waitFor({state: 'visible'});
      /**
       * Locates the DOM elements used by theme style.
       * @return {*} Matching DOM element, if present.
       */
      const themeStyle = () => page.evaluate(() => ({
        theme: document.documentElement.dataset.theme,
        filter: getComputedStyle(document.querySelector('.map-tiles')).filter,
        mapBackground: getComputedStyle(document.querySelector('.map-canvas'))
          .backgroundColor,
        markerFilter: getComputedStyle(document.querySelector('.map-marker'))
          .filter,
        controlsBg: getComputedStyle(document.querySelector(
          '.map-controls button')).backgroundColor,
      }));
      const initial = await themeStyle();
      await page.locator('[data-act="toggle-theme"]').click();
      const toggled = await themeStyle();
      assert.notEqual(
        toggled.theme,
        initial.theme,
        'theme switch must work without leaving the map'
      );
      assert.notEqual(
        toggled.filter,
        initial.filter,
        'OSM tiles must change appearance'
      );
      const darker = initial.theme === 'dark' ? initial : toggled;
      const lighter = initial.theme === 'light' ? initial : toggled;
      assert.match(
        darker.filter,
        /invert\(0\.91\).*brightness\(1\.02\).*contrast\(0\.96\)/,
        'dark OSM palette must remain readable and brighter than the old \
map style'
      );
      assert.equal(
        lighter.filter,
        'none',
        'light OSM tiles must be unfiltered'
      );
      assert.notEqual(
        toggled.mapBackground,
        initial.mapBackground,
        'map loading background must follow theme'
      );
      assert.notEqual(
        toggled.controlsBg,
        initial.controlsBg,
        'map controls must follow theme'
      );
      assert.equal(
        toggled.markerFilter,
        'none',
        'markers must not be colour-inverted'
      );
      await page.locator('[data-act="toggle-theme"]').click();
      assert.deepEqual(
        await themeStyle(),
        initial,
        'switching back restores the original map style'
      );

      /**
       * Derives the rect center result from the supplied values.
       * @return {!Promise<*>} Promise for the asynchronous operation.
       */
      const rectCenter = async () => marker.evaluate(element => {
        const r = element.getBoundingClientRect();
        return {x: r.left + r.width / 2, y: r.top + r.height / 2};
      });
      const initialMarker = await rectCenter();
      const initialZoom = Number((await page.locator('.map-zoom-level')
        .innerText()).replace('Zoom ',
          ''
        ));
      await page.mouse.move(initialMarker.x, initialMarker.y);
      await page.mouse.wheel(0, -160);
      await page.waitForFunction(
        before => document.querySelector('.map-zoom-level')?.textContent ===
          `Zoom ${before + 1}`,
        initialZoom
      );
      const afterIn = await rectCenter();
      assert.ok(
        Math.abs(afterIn.x - initialMarker.x) < 2 && Math.abs(afterIn.y -
          initialMarker.y) < 2,
        `wheel under marker moved anchored location: ${JSON.stringify({
          initialMarker, afterIn,
        })}`
      );

      // Zooming out around a point next to the marker must scale the marker's
      // distance to the pointer by 1/2, not use the map's screen centre.
      const viewport = await page.locator('.map-viewport').boundingBox();
      const pointer = {
        x: Math.min(viewport.x + viewport.width - 12, afterIn.x + 45),
        y: Math.min(viewport.y + viewport.height - 12, afterIn.y + 35),
      };
      await page.mouse.move(pointer.x, pointer.y);
      await page.mouse.wheel(0, 160);
      await page.waitForFunction(
        before => document.querySelector('.map-zoom-level')?.textContent ===
          `Zoom ${before}`,
        initialZoom
      );
      const afterOut = await rectCenter();
      const expected = {
        x: (afterIn.x + pointer.x) / 2, y: (afterIn.y +
          pointer.y) / 2,
      };
      assert.ok(
        Math.abs(afterOut.x - expected.x) < 2 && Math.abs(afterOut.y -
          expected.y) < 2,
        `wheel off marker must preserve cursor position: ${JSON.stringify({
          expected, afterOut,
        })}`
      );
    });
  }
);



test(
  'browser: analytics dashboard, six pages, filters, deep links and drill-down',
  async () => {
    await session(async ({page, open, base}) => {
      const catalog = (await requestJson(base, '/api/collection')).data
        .distilleries;
      const site = catalog.find(d => d.name === 'Kilchoman');
      assert.ok(site);
      const created = await requestJson(base, '/api/bottlings', 'POST', {
        name: 'Analysis Test Whisky',
        distilleryIds: [site.id],
        country: 'Scotland',
        ageYears: 8,
        abv: 46,
        firstBottle: {
          inventoryNumber: '987421',
          status: 'closed',
          volumeType: 'standard',
          volumeMl: 700,
          purchasePrice: 50,
          currency: 'EUR',
          purchaseDate: '2026-07-11',
        },
      });
      assert.equal(created.status, 201);
      await open();
      await page.locator('header [data-act="toggle-menu"]').click();
      await page.locator('#site-drawer [data-act="goto-analysis"]').click();
      await page.locator('.analytics-metric').first().waitFor();
      assert.equal(await page.locator('.analytics-section-card').count(), 6);
      // Hovering any part of the final Top-Destillerien row must underline its
      // link.
      const lastTopRow = page.locator('.analytics-panel')
        .filter({has: page.locator('h3', {hasText: 'Top-Destillerien'})})
        .locator('.analytics-bar-row').last();
      const lastTopLink =
        lastTopRow.locator('button.analytics-bar-label.analytics-link');
      assert.equal(await lastTopLink.count(), 1);
      // The full-row click target overlays the track; move the mouse to its
      // position directly.
      const barBox = await lastTopRow.locator('.analytics-bar-track')
        .boundingBox();
      assert.ok(barBox);
      await page.mouse.move(
        barBox.x + barBox.width / 2,
        barBox.y + barBox.height / 2
      );
      assert.equal(
        await lastTopLink.evaluate(el => getComputedStyle(el)
          .textDecorationLine),
        'underline'
      );
      await page.locator('[data-analytics-filter="distillery"]')
        .selectOption(site.id);
      assert.equal(
        await page.locator('[data-analytics-filter="distillery"]').inputValue(),
        site.id
      );
      for (const section of ['inventory', 'origins', 'profile', 'finance',
        'timeline', 'quality']) {
        await page.locator(`.section-nav-item[data-section="${section}"]`)
          .click();
        assert.equal(await page.locator('.analytics-section-title').count(), 1);
        assert.equal(
          await page.locator('[data-analytics-filter="distillery"]')
            .inputValue(),
          site.id
        );
      }
      await page.locator('.section-nav-item[data-section="origins"]').click();
      await page.locator(
        '.analytics-bar-label[data-act="analytics-distillery"]').first().click(
      );
      await page.locator('.collection-heading').waitFor();
      assert.equal(
        await page.locator('#filter-distillery').inputValue(),
        site.id
      );
      await page.locator('header [data-act="toggle-menu"]').click();
      await page.locator('#site-drawer [data-act="goto-analysis"]').click();
      await page.locator('.section-nav-item[data-section="finance"]').click();
      assert.match(
        await page.locator('.analytics-page').innerText(),
        /Dokumentierte Ausgaben/i
      );
      await page.locator('[data-act="analytics-reset"]').click();
      assert.equal(
        await page.locator('[data-analytics-filter="distillery"]').inputValue(),
        'all'
      );
      if (!domOnly) {
        await page.locator('[data-analytics-filter="country"]')
          .selectOption('Schottland');
        await page.reload();
        assert.equal(
          await page.locator('[data-analytics-filter="country"]').inputValue(),
          'Schottland'
        );
      }
      // A content-rich analytics page must not leave excessive whitespace
      // before the footer.
      // Use a short viewport so the sticky footer cannot mask excessive content
      // padding.
      await page.setViewportSize({width: 1366, height: 500});
      await page.locator('.section-nav-item[data-section="profile"]').click();
      const footerGap = await page.evaluate(() => {
        const content = document.querySelector('.analytics-page')
          .getBoundingClientRect();
        const footer = document.querySelector('.site-footer')
          .getBoundingClientRect();
        return footer.top - content.bottom;
      });
      assert.ok(footerGap >= 0 && footerGap <= 55,
        `analytics footer must follow the final note with compact spacing \
(${footerGap}px)`);
      const overflow = await page.evaluate(() => document.body.scrollWidth -
        document.body.getBoundingClientRect().width);
      assert.ok(
        overflow <= 1,
        `analytics desktop horizontal overflow: ${overflow}px`
      );
    });
  }
);



test(
  'browser: detail map link opens all locations of a multi-distillery \
bottling and remains reloadable',
  async () => {
    await session(async ({page, open, base}) => {
      const catalog = (await requestJson(base, '/api/collection')).data
        .distilleries;
      const ardbeg = catalog.find(site => site.name === 'Ardbeg');
      const kilchoman = catalog.find(site => site.name === 'Kilchoman');
      assert.ok(ardbeg && kilchoman);
      const result = await requestJson(base, '/api/bottlings', 'POST', {
        name: 'Map Focus Blend',
        whiskyType: 'blended_malt',
        distilleryIds: [ardbeg.id, kilchoman.id],
        firstBottle: {inventoryNumber: '098401', status: 'closed'},
      });
      assert.equal(result.status, 201);
      await open();
      await page.locator(`[data-act="open"][data-id="${result.data.bottling
        .id}"]`).first().click();
      await page.locator('[data-act="bottling-map"]').click();
      assert.equal(await page.locator('.map-related-site').count(), 2);
      assert.match(
        await page.locator('.map-related-bottling').innerText(),
        /Map Focus Blend/
      );
      assert.equal(
        await page.locator('.map-related-site').first()
          .getAttribute('data-map-focus') != null,
        true
      );
      // In DOM-only mode History is intentionally stubbed and location stays
      // about:blank; assert the recorded navigation target instead.
      const routeUrl = domOnly
        ? await page.evaluate(() => window.__historyCalls.at(-1)?.url || '')
        : page.url();
      assert.match(routeUrl, /view=map&focusBottling=/);
      const zoom = await page.locator('.map-zoom-level').innerText();
      assert.match(zoom, /^Zoom (?:\d+)$/);
      await page.locator(`[data-map-focus="${kilchoman.id}"]`).click();
      assert.equal(
        await page.locator('#map-site-select').inputValue(),
        kilchoman.id
      );
      if (!domOnly) {
        await page.reload();
        await page.locator('.map-related-site').nth(1).waitFor();
        assert.equal(await page.locator('.map-related-site').count(), 2);
      }
    });
  }
);



test(
  'browser: phone detail title, mobile analytics selector and period \
controls, and overview view switch fit their layout',
  async () => {
    await session(async ({page, open, base}) => {
      const catalog = (await requestJson(base, '/api/collection')).data
        .distilleries;
      const site = catalog.find(d => d.name === 'Kilchoman') || catalog[0];
      assert.ok(site);
      const created = await requestJson(base, '/api/bottlings', 'POST', {
        name: 'Very long Waterford Ballykilcavan: Edition 1.1 release',
        distilleryIds: [site.id],
        firstBottle: {inventoryNumber: '987427', status: 'closed'},
      });
      assert.equal(created.status, 201);
      await page.setViewportSize({width: 390, height: 844});
      await open();
      await page.locator(`.whisky-card[data-id="${created.data.bottling
        .id}"]`).click();
      const detail = await page.evaluate(() => {
        const heading = document.querySelector('.detail-page-head');
        const title = heading.querySelector('h2').getBoundingClientRect();
        const actions = heading.querySelector('.detail-head-actions')
          .getBoundingClientRect();
        const map = heading.querySelector('[data-act="bottling-map"]')
          .getBoundingClientRect();
        const edit = heading.querySelector('[data-act="edit-bottling"]')
          .getBoundingClientRect();
        const remove = heading.querySelector('[data-act="delete-bottling"]')
          .getBoundingClientRect();
        const parent = heading.getBoundingClientRect();
        return {title, actions, map, edit, remove, parent};
      });
      assert.ok(
        detail.title.right <= detail.parent.right + 2,
        'title must fit inside the detail header'
      );
      assert.ok(
        detail.actions.top >= detail.title.bottom,
        'all action buttons belong below the title'
      );
      assert.ok(
        detail.map.bottom <= detail.edit.top,
        'map button is its own first row'
      );
      assert.ok(
        Math.abs(detail.edit.top - detail.remove.top) <= 1,
        'edit and delete share the same row'
      );
      assert.ok(
        detail.actions.right <= detail.parent.right + 2,
        'action buttons must not overflow'
      );

      await page.locator('[data-act="back"]').first().click();
      await page.locator('[data-act="toggle-collection-filters"]').click();
      const toolbarHeights = await page.evaluate(() => [
        '#search', '#filter-status', '#filter-completion', '#filter-sort',
        '#filter-distillery', '#filter-volume-type', '[data-act="toggle-view"]',
      ].map(selector => Math.round(document.querySelector(
        `.toolbar ${selector}`).getBoundingClientRect().height)));
      assert.equal(
        new Set(toolbarHeights).size,
        1,
        `all toolbar elements should match: ${toolbarHeights}`
      );
      // Phone and narrow Android layouts must not force native selects/inputs
      // beyond their flex row; the view switch keeps its own usable width.
      for (const width of [320, 360, 390, 412, 600]) {
        await page.setViewportSize({width, height: 844});
        const tooWide = await page.evaluate(() =>
          [...document.querySelectorAll('.toolbar input, .toolbar select')]
            .filter(el => {
              const r = el.getBoundingClientRect();
              const parent = el.parentElement.getBoundingClientRect();
              return r.right > parent.right + 1 || r.left < parent.left - 1;
            }).map(el => el.id || el.outerHTML.slice(0, 50)));
        assert.deepEqual(
          tooWide,
          [],
          `overview fields should not overflow at ${width}px`
        );
      }
      await page.setViewportSize({width: 390, height: 844});

      await page.locator('header [data-act="toggle-menu"]').click();
      await page.locator('#site-drawer [data-act="goto-analysis"]').click();
      await page.locator('[data-section-switch="analytics"]')
        .selectOption('quality');
      assert.equal(
        await page.locator('.analytics-section-title').innerText(),
        'Datenqualität'
      );
      assert.equal(
        await page.locator('[data-section-switch="analytics"]').inputValue(),
        'quality'
      );
      assert.equal(
        await page.locator('.section-nav-desktop').isVisible(),
        false,
        'desktop navigation is hidden in the mobile layout'
      );
      await page.locator('[data-section-switch="analytics"]')
        .selectOption('timeline');
      // The date input is inset inside the 44px bordered control. Compare the
      // visible controls, not the inner input (which is 42px by design).
      const periodGeometry = await page.evaluate(() => [
        document.querySelector('#analytics-period'),
        ...document.querySelectorAll('.analytics-date-control'),
      ].map(el => {
        const {width, height} = el.getBoundingClientRect();
        return [Math.round(width), Math.round(height)];
      }));
      assert.equal(new Set(periodGeometry.map(([, height]) => height)).size, 1,
        `period controls should have equal heights: ${JSON.stringify(
          periodGeometry)}`);
      assert.equal(new Set(periodGeometry.map(([width]) => width)).size, 1,
        `period controls should have equal widths on phones: ${JSON.stringify(
          periodGeometry)}`);
      await page.locator('#analytics-start-date').fill('2026-01-15');
      assert.equal(
        await page.locator('#analytics-start-date').inputValue(),
        '2026-01-15'
      );
      await page.locator('#analytics-end-date').fill('2026-12-31');
      assert.equal(
        await page.locator('#analytics-end-date').inputValue(),
        '2026-12-31'
      );
      await page.locator('#analytics-start-date').fill('');
      assert.equal(
        await page.locator('#analytics-start-date').inputValue(),
        ''
      );
      for (const width of [320, 360, 390, 412, 600]) {
        await page.setViewportSize({width, height: 844});
        const tooWide = await page.evaluate(() =>
          [...document.querySelectorAll(
            '.analytics-period input, .analytics-period select, \
.analytics-filters select')]
            .filter(el => {
              const r = el.getBoundingClientRect();
              const parent = el.parentElement.getBoundingClientRect();
              return r.right > parent.right + 1 || r.left < parent.left - 1;
            }).map(el => el.id || el.outerHTML.slice(0, 50)));
        assert.deepEqual(
          tooWide,
          [],
          `analysis fields should not overflow at ${width}px`
        );
      }
      await page.setViewportSize({width: 390, height: 844});
      await openSettingsFromMenu(page);
      await openSettingsSection(page, 'distilleries');
      await page.locator('#distillery-search').fill('Ardbeg');
      await page.locator(
        '.distillery-row:visible [data-act="rename-distillery"]').first(
      ).click();
      await page.locator('#distillery-form').waitFor();
      for (const width of [320, 360, 390, 412]) {
        await page.setViewportSize({width, height: 844});
        const tooWide = await page.evaluate(() =>
          [...document.querySelectorAll(
            '#distillery-form input, #distillery-form select')]
            .filter(el => {
              const r = el.getBoundingClientRect();
              const parent = el.parentElement.getBoundingClientRect();
              return r.right > parent.right + 1 || r.left < parent.left - 1;
            }).map(el => el.id));
        assert.deepEqual(
          tooWide,
          [],
          `distillery dialog fields should not overflow at ${width}px`
        );
      }
    });
  }
);
