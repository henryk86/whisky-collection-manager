import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HELP_TOPICS} from '../../public/js/views/help.js';
import {startTestServer, requestJson} from '../helpers/server.js';
import {domOnly, chromium, session, openSettingsFromMenu, openSettingsSection, seed, mockDecoder} from './support.js';
test(
  'browser: bottling editor shows external import preview only after incoming data',
  async () => {
    await session(async ({page, open}) => {
      await open();
      await page.locator('[data-act="new"]').first().click();
      await page.locator('#bottling-form').waitFor();
      assert.equal(
        await page.locator('#bottling-form #import-panel').count(),
        0
      );
      assert.equal(
        await page.locator('#bottling-form [data-act="import-search"]').count(),
        0
      );
      assert.equal(
        await page.locator('#bottling-form a[href*="whiskybase.com"]').count(),
        0
      );
      await page.locator('#bottling-form [data-act="close-modal"]').click();
      await page.evaluate(() => {
        const payload = {
          version: 2, source: 'external',
          fields: {
            whiskybaseId: '765432', name: 'Private import example',
            whiskybaseUrl: 'https://www.whiskybase.com/whiskies/whisky/765432/example',
          },
        };
        location.hash = '#wcm-import=' +
          encodeURIComponent(JSON.stringify(payload));
      });
      await page.locator('#import-panel .import-preview').waitFor();
      assert.equal(
        await page.locator('#bottling-form #import-panel').count(),
        1
      );
      assert.equal(
        await page.locator('#import-panel [data-act="import-apply"]').count(),
        1
      );
      assert.equal(
        await page.locator('#import-panel input[data-import-field="name"]')
          .count(),
        1
      );
    });
  }
);



test(
  'browser: Whiskybase import assigns four comma-separated distilleries to one bottling',
  async () => {
    await session(async ({page, open, base}) => {
      await open();
      const originalCollection =
        (await requestJson(base, '/api/collection')).data;
      const expectedNames = ['Caol Ila', 'Bowmore', 'Ardbeg', 'Port Ellen'];
      const expectedIds = expectedNames.map(name =>
        originalCollection.distilleries.find(item => item.name === name)?.id);
      assert.ok(
        expectedIds.every(Boolean),
        'all four distilleries are in the catalog'
      );
      await page.evaluate(() => {
        const payload = {
          version: 2,
          source: 'external',
          distilleryName: 'Caol Ila, Bowmore, Ardbeg, Port Ellen',
          fields: {
            whiskybaseId: '987654',
            name: 'Four-Distillery Blended Malt',
            whiskyType: 'blended_malt',
            whiskybaseUrl: 'https://www.whiskybase.com/whiskies/whisky/987654/test',
          },
        };
        location.hash = '#wcm-import=' +
          encodeURIComponent(JSON.stringify(payload));
      });
      await page.locator('#import-panel input[name="import-distillery"]')
        .first().waitFor();
      const importOptions =
        page.locator('#import-panel input[name="import-distillery"]');
      assert.equal(await importOptions.count(), 4);
      assert.deepEqual(
        await importOptions.evaluateAll(inputs => inputs.map(input =>
          input.value)),
        expectedIds
      );
      assert.equal(
        await page.locator('#import-panel input[name="import-distillery"]:checked').count(),
        4
      );
      assert.equal(
        await page.locator('#import-panel input[name="import-distillery"]:disabled').count(),
        0
      );
      await page.locator('#import-panel [data-act="import-apply"]').click();
      const selectedIds =
        await page.locator('#bottling-form input[name="distilleryIds"]:checked')
          .evaluateAll(inputs => inputs.map(input => input.value));
      assert.deepEqual(new Set(selectedIds), new Set(expectedIds));
      await page.locator('#bottling-form button[type="submit"]').click();
      await page.locator('.section-head h2')
        .filter({hasText: 'Four-Distillery Blended Malt'}).waitFor();
      const saved = (await requestJson(base, '/api/collection')).data.bottlings
        .find(item => item.name === 'Four-Distillery Blended Malt');
      assert.ok(saved);
      assert.deepEqual(new Set(saved.distilleryIds), new Set(expectedIds));
    });
  }
);



test(
  'browser: create a bottling, read-only bottle context, edit and photo upload',
  async () => {
    await session(async ({page, open, base}) => {
      await open();
      await page.locator('[data-act="new"]').first().click();
      await page.locator('[name="name"]').fill('UI Lifecycle');
      await page.locator('[name="firstInventoryNumber"]').fill('000321');
      await page.locator('#bottling-form button[type="submit"]').click();
      await page.waitForSelector('[data-act="edit-bottling"]');
      assert.equal(
        await page.locator('.section-head h2').innerText(),
        'UI Lifecycle'
      );
      await page.locator('[data-act="edit-bottle"]').click();
      assert.equal(
        await page.locator('.bottling-context-name').innerText(),
        'UI Lifecycle'
      );
      assert.equal(
        await page.locator('.bottling-context input, .bottling-context select').count(),
        0
      );
      assert.equal(await page.locator('[name="inventoryNumber"]').count(), 1);
      await page.locator('[name="comment"]').fill('Edited from the browser');
      await page.locator('[name="openedAt"]').fill('2026-10-18');
      await page.locator('[name="photos"]').setInputFiles({
        name: 'test.png', mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=',
          'base64'
        ),
      });
      await page.locator('#bottle-form button[type="submit"]').click();
      await page.waitForSelector('.photo-tile');
      const facts = await page.locator('.bottle-entry-facts').innerText();
      assert.match(facts, /Öffnungsdatum/);
      assert.match(facts, /18\.10\.2026/);
      assert.match(facts, /Persönlicher Kommentar/);
      assert.match(facts, /Edited from the browser/);
      // Photo previews must remain in this browser tab; the lightbox also
      // supports Escape, the large cover image and backdrop dismissal.
      await page.locator('.photo-tile [data-act="open-photo"]').click();
      await page.waitForSelector('.photo-lightbox-image');
      /**
       * Derives the viewer style result from the supplied values.
       * @return {*} Result computed from the supplied inputs.
       */
      const viewerStyle = () => page.locator('.photo-lightbox-stage')
        .evaluate(el => getComputedStyle(el).backgroundColor);
      const viewerBefore = await viewerStyle();
      await page.evaluate(() => {
        document.documentElement.dataset.theme = document.documentElement
          .dataset.theme === 'dark' ? 'light' : 'dark';
      });
      assert.notEqual(
        await viewerStyle(),
        viewerBefore,
        'Photo viewer background must match the light/dark theme'
      );
      // Zoom affects only the preview: the modal stays in this tab, and
      // closing it still restores the nested bottle form unchanged.
      const zoomLevel = page.locator('[data-photo-zoom-level]');
      assert.equal(await zoomLevel.innerText(), '100 %');
      await page.locator('[data-act="photo-zoom-in"]').click();
      assert.equal(await zoomLevel.innerText(), '125 %');
      assert.match(
        await page.locator('.photo-lightbox-image').evaluate(img =>
          img.style.transform),
        /scale\(1\.25\)/
      );
      await page.locator('[data-act="photo-zoom-reset"]').click();
      assert.equal(await zoomLevel.innerText(), '100 %');
      const zoomStage = page.locator('.photo-lightbox-stage');
      await zoomStage.hover();
      await page.mouse.wheel(0, -150);
      await page.waitForFunction(() =>
        document.querySelector('[data-photo-zoom-level]')?.textContent !==
        '100 %');
      assert.equal(
        await page.context().pages().length,
        1,
        'no extra browser tab'
      );
      await page.keyboard.press('Escape');
      await page.waitForSelector('.photo-lightbox-image', {state: 'detached'});
      await page.locator('.hero-photo-open').click();
      await page.waitForSelector('.photo-lightbox-image');
      await page.locator('.overlay').click({position: {x: 3, y: 3}});
      await page.waitForSelector('.photo-lightbox-image', {state: 'detached'});
      const saved = await requestJson(base, '/api/collection');
      assert.equal(
        saved.data.bottlings[0].bottles[0].comment,
        'Edited from the browser'
      );
      assert.equal(saved.data.bottlings[0].bottles[0].openedAt, '2026-10-18');
      assert.equal(saved.data.bottlings[0].bottles[0].photos.length, 1);
      assert.equal(saved.data.bottles, undefined);
    });
  }
);


test(
  'browser: Chrome pointer dragging reorders bottle photos without opening the viewer',
  async () => {
    await session(async ({page, open, base}) => {
      const {bottling, bottle} = await seed(base, '000325');
      const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=';
      const photos = [];
      for (let i = 0; i < 3; i++) {
        const saved = await requestJson(
          base,
          `/api/bottles/${bottle.id}/photos`,
          'POST',
          {image: png}
        );
        assert.equal(saved.status, 201);
        photos.push(saved.data.id);
      }
      await open({query: `?bottling=${bottling.id}`});
      const gallery = page.locator(`[data-photo-list="${bottle.id}"]`);
      await gallery.locator('[data-photo-tile]').first().waitFor();
      /**
       * Transforms the entries used by order.
       * @return {*} Entries transformed for the consuming code.
       */
      const order = () => gallery.locator('[data-photo-tile]')
        .evaluateAll(tiles => tiles.map(tile => tile.dataset.photoId));

      /**
       * Calculates the drag numeric value.
       *
       * @param {*} source Input source to inspect.
       * @param {*=} target Target of the operation.
       * @return {!Promise<*>} Promise for the asynchronous operation.
       */
      const drag = async (source, target = null) => {
        // Mouse coordinates do not automatically scroll an offscreen gallery.
        // The tasting section above the physical bottles can place the photos
        // below the viewport, where raw page.mouse events never hit them.
        await source.scrollIntoViewIfNeeded();
        if (target) await target.scrollIntoViewIfNeeded();
        const start = await source.boundingBox();
        const end = target ? await target.boundingBox() :
          await gallery.boundingBox();
        assert.ok(start && end);
        const viewport = page.viewportSize();
        const startPoint = {
          x: start.x + start.width / 2, y: start.y +
            start.height / 2,
        };
        // A cancelled drag can end just to the left of the gallery. Do not
        // scroll the distant page heading into view and hide the source.
        const endPoint = target
          ? {x: end.x + end.width / 2, y: end.y + end.height / 2}
          : {x: Math.max(2, end.x - 20), y: startPoint.y};
        assert.ok(
          [startPoint, endPoint].every(point => point.x >= 0 && point.y >= 0 &&
            point.x < viewport.width && point.y < viewport.height),
          'photo drag coordinates must be visible to pointer events'
        );
        await page.mouse.move(startPoint.x, startPoint.y);
        await page.mouse.down();
        await page.mouse.move(endPoint.x, endPoint.y, {steps: 8});
        await page.mouse.up();
      };
      // Dragging the handle must use the position under the pointer at release.
      await drag(
        gallery.locator('[data-photo-tile]').first()
          .locator('[data-photo-drag]'),
        gallery.locator('[data-photo-tile]').last()
      );
      await page.waitForFunction(expected => {
        const tiles = document.querySelectorAll('[data-photo-list] [data-photo-tile]');
        return JSON.stringify([...tiles].map(t => t.dataset.photoId)) ===
          JSON.stringify(expected);
      }, [photos[1], photos[2], photos[0]]);
      assert.deepEqual(await order(), [photos[1], photos[2], photos[0]]);

      // Chrome starts native image dragging by default. Pointer-based thumbnail
      // dragging must save the order without opening the photo lightbox.
      await drag(
        gallery.locator('[data-photo-tile]').last().locator('.photo-open'),
        gallery.locator('[data-photo-tile]').first()
      );
      await page.waitForFunction(expected => {
        const tiles = document.querySelectorAll('[data-photo-list] [data-photo-tile]');
        return JSON.stringify([...tiles].map(t => t.dataset.photoId)) ===
          JSON.stringify(expected);
      }, [photos[0], photos[1], photos[2]]);
      assert.equal(await page.locator('.photo-lightbox-image').count(), 0);
      assert.deepEqual(
        (await requestJson(base, '/api/collection')).data.bottlings[0]
          .bottles[0]
          .photos.map(p => p.id),
        [photos[0], photos[1], photos[2]]
      );

      // Cancel a drag outside the gallery: no stale target should be saved.
      await drag(gallery.locator('[data-photo-tile]').first()
        .locator('[data-photo-drag]'));
      assert.deepEqual(await order(), [photos[0], photos[1], photos[2]]);

      // A plain photo click still opens the lightbox after the drag.
      await gallery.locator('.photo-open').first().click();
      await page.locator('.photo-lightbox-image').waitFor();
      await page.keyboard.press('Escape');
      await page.locator('.photo-lightbox-image').waitFor({state: 'detached'});
    });
  }
);



test(
  'browser: new bottle can reuse an existing bottling or create a new one',
  async () => {
    await session(async ({page, open, base}) => {
      const existing = await seed(base, '009100');
      await page.setViewportSize({width: 390, height: 844});
      await open();
      await page.locator('header [data-act="new"]').click();
      await page.waitForSelector('#new-bottle-choice-form');
      assert.equal(
        await page.evaluate(() => document.body.scrollWidth <= document.body
          .getBoundingClientRect().width + 1),
        true,
        'mobile picker must not overflow'
      );
      // Search does not silently create a second bottling or preselect a
      // result.
      await page.locator('#bottling-choice-search').fill('nicht vorhanden');
      assert.equal(
        await page.locator('#bottling-choice-select option').count(),
        1
      );
      await page.locator('#bottling-choice-search').fill('Browser Test');
      assert.equal(
        await page.locator('#bottling-choice-select option').count(),
        2
      );
      assert.equal(
        await page.locator('#bottling-choice-select').inputValue(),
        ''
      );
      await page.locator('#bottling-choice-select')
        .selectOption(existing.bottling.id);
      await page.locator('#new-bottle-choice-form button[type="submit"]')
        .click();
      await page.waitForSelector('#bottle-form[data-from-overview="1"]');
      assert.equal(
        await page.locator('.bottling-context-name').innerText(),
        'Browser Test Blend'
      );
      assert.equal(await page.locator('#bottle-form [name="name"]').count(), 0);
      await page.locator('#bottle-form [name="inventoryNumber"]')
        .fill('009101');
      await page.locator('#bottle-form [name="status"]').selectOption('open');
      await page.locator('#bottle-form button[type="submit"]').click();
      await page.waitForSelector('.bottle-entry.scanned-bottle');
      const saved = (await requestJson(base, '/api/collection')).data;
      assert.equal(
        saved.bottlings.length,
        1,
        'same parent, no duplicate bottling'
      );
      assert.equal(saved.bottlings[0].bottles.length, 2);
      assert.equal(
        saved.bottlings[0].bottles.find(bottle => bottle.inventoryNumber ===
          '009101').status,
        'open'
      );
      await page.locator('header [data-act="new"]').click();
      await page.waitForSelector('#new-bottle-choice-form');
      await page.locator('[data-act="new-bottling-direct"]').click();
      await page.locator('#bottling-form [name="name"]')
        .fill('Neues unabhängiges Produkt');
      await page.locator('#bottling-form [name="firstInventoryNumber"]')
        .fill('009102');
      await page.locator('#bottling-form button[type="submit"]').click();
      await page.waitForSelector('.section-head h2');
      const next = (await requestJson(base, '/api/collection')).data;
      assert.equal(
        next.bottlings.length,
        2,
        'explicitly requested a new bottling'
      );
      assert.ok(next.bottlings.some(bottling => bottling.name ===
        'Neues unabhängiges Produkt'));
    });
  }
);



test(
  'browser: a decoded inventory number opens details at the top, without edit mode',
  async () => {
    await session(async ({page, base, open}) => {
      const data = await seed(base);
      let target;
      for (let index = 0; index < 8; index++) {
        const result = await requestJson(base, '/api/bottles', 'POST', {
          bottlingId: data.bottling.id, inventoryNumber: `TEST-${index}`,
        });
        target = result.data;
      }
      await open();
      await mockDecoder(page);
      await page.locator('[data-act="scan"]').first().click();
      await page.waitForFunction(() => !!window.__decoded);
      await page.evaluate(
        number => window.__decoded(number),
        target.inventoryNumber
      );
      await page.waitForSelector(`#bottle-${target.id}.scanned-bottle`);
      assert.equal(await page.locator('.overlay').count(), 0);
      await page.waitForFunction(() => window.scrollY < 5);
      assert.ok(await page.evaluate(() => window.__stopped >= 1));
      assert.equal(
        await page.locator('.section-head h2').innerText(),
        'Browser Test Blend'
      );
    });
  }
);


test(
  'browser: scanning into an edit form retains the bottle ID and unsaved comment',
  async () => {
    await session(async ({page, base, open}) => {
      const data = await seed(base);
      await open();
      await page.locator('.whisky-card').click();
      await page.locator('[data-act="edit-bottle"]').click();
      await page.locator('[name="comment"]').fill('Do not lose this text');
      await mockDecoder(page);
      await page.locator('[data-act="scan-into-bottle"]').click();
      await page.waitForFunction(() => !!window.__decoded);
      await page.evaluate(() => window.__decoded('008888'));
      await page.waitForSelector('#bottle-form');
      assert.equal(
        await page.locator('[name="inventoryNumber"]').inputValue(),
        '008888'
      );
      assert.equal(
        await page.locator('[name="comment"]').inputValue(),
        'Do not lose this text'
      );
      assert.equal(
        await page.locator('#bottle-form').getAttribute('data-id'),
        data.bottle.id
      );
      await page.locator('#bottle-form button[type="submit"]').click();
      await page.waitForSelector('.overlay', {
        state: 'detached',
      });
      const saved = await requestJson(base, '/api/collection');
      assert.equal(saved.data.bottlings[0].bottles.length, 1);
      assert.equal(saved.data.bottlings[0].bottles[0].id, data.bottle.id);
      assert.equal(
        saved.data.bottlings[0].bottles[0].inventoryNumber,
        '008888'
      );
    });
  }
);


test(
  'browser: the mobile header stays in one row at responsive widths',
  async () => {
    await session(async ({page, open}) => {
      await open();
      await page.waitForSelector('.site-header .top-actions');
      for (const width of [320, 360, 390, 450, 600, 740, 900, 960]) {
        await page.setViewportSize({width, height: 844});
        const layout = await page.evaluate(() => {
          const brand = document.querySelector('.site-header .brand')
            .getBoundingClientRect();
          const actions = document.querySelector('.site-header .top-actions')
            .getBoundingClientRect();
          const header = document.querySelector('.site-header')
            .getBoundingClientRect();
          const buttons =
            [...document.querySelectorAll('.site-header .top-actions > button')];
          return {
            brandRight: brand.right, actionsLeft: actions.left,
            brandCenter: brand.top + brand.height / 2,
            actionsCenter: actions.top + actions.height / 2,
            headerHeight: header.height,
            buttons: buttons.map(button => ({
              visible: getComputedStyle(button).display !== 'none',
              top: button.getBoundingClientRect().top,
              height: button.getBoundingClientRect().height,
            })),
            overflow: document.body.scrollWidth > document.body
              .getBoundingClientRect().width + 1,
          };
        });
        assert.equal(
          layout.buttons.length,
          4,
          `All four header actions retained at ${width}px`
        );
        assert.ok(
          layout.buttons.every(button => button.visible && button.height >= 40),
          `Buttons are usable at ${width}px`
        );
        assert.ok(
          layout.brandRight + 2 <= layout.actionsLeft,
          `No brand/button overlap at ${width}px`
        );
        assert.ok(
          Math.abs(layout.brandCenter - layout.actionsCenter) < 3,
          `Brand and actions in same row at ${width}px`
        );
        assert.ok(
          layout.buttons.every(button => Math.abs(button.top -
            layout.buttons[0].top) < 1),
          `All actions in same row at ${width}px`
        );
        assert.ok(
          layout.headerHeight <= (width <= 380 ? 66 : width <= 740 ? 74 : 82),
          `Compact mobile header at ${width}px`
        );
        assert.equal(
          layout.overflow,
          false,
          `No horizontal overflow at ${width}px`
        );
      }
      assert.equal(
        await page.locator('header [data-act="scan"]')
          .getAttribute('aria-label'),
        'Inventar scannen'
      );
      assert.equal(
        await page.locator('header [data-act="new"]')
          .getAttribute('aria-label'),
        'Neue Flasche'
      );
      assert.equal(
        await page.locator('header [data-act="settings"]').count(),
        0
      );
      assert.equal(
        await page.locator('header [data-act="scan"] .scan-icon').isVisible(),
        true
      );
      assert.equal(
        await page.locator('header [data-act="new"] .new-icon').isVisible(),
        true
      );
      assert.equal(
        await page.locator('header [data-act="new"]').evaluate(el =>
          el.firstElementChild.tagName),
        'svg'
      );
    });
  }
);


test(
  'browser: persistent scrollbar track keeps centered content stationary',
  async t => {
    // Playwright's default --hide-scrollbars makes a centering regression
    // undetectable. Run this case with visible classic scrollbars instead.
    const scrollbarBrowser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
      headless: true,
      ignoreDefaultArgs: ['--hide-scrollbars'],
      args: process.env.CI || domOnly ? ['--no-sandbox'] : [],
    });
    try {
      await session(async ({page, open}) => {
        await open();
        await page.setViewportSize({width: 1366, height: 900});
        await page.evaluate(() => {
          document.querySelector('#app').style.display = 'none';
          document.body.style.minHeight = '0';
          const probe = document.createElement('div');
          probe.id = 'scrollbar-layout-probe';
          probe.style.cssText =
            'width:600px;max-width:100%;margin:0 auto;height:1px';
          document.body.appendChild(probe);
        });
        /**
         * Locates the DOM elements used by measure.
         * @return {*} Matching DOM element, if present.
         */
        const measure = () => page.evaluate(() => ({
          overflowY: getComputedStyle(document.documentElement).overflowY,
          clientWidth: document.body.getBoundingClientRect().width,
          left: document.querySelector('#scrollbar-layout-probe')
            .getBoundingClientRect().left,
          scrollHeight: document.documentElement.scrollHeight,
          viewportHeight: window.innerHeight,
        }));
        const shortPage = await measure();
        assert.equal(shortPage.overflowY, 'scroll');
        assert.ok(shortPage.scrollHeight <= shortPage.viewportHeight);
        await page.evaluate(() => {
          const filler = document.createElement('div');
          filler.id = 'scrollbar-layout-filler';
          filler.style.height = '3000px';
          document.body.appendChild(filler);
        });
        const longPage = await measure();
        assert.ok(longPage.scrollHeight > longPage.viewportHeight);
        // Prove the browser has a physical scrollbar before claiming a pass.
        await page.evaluate(() => {
          document.documentElement.style.overflowY =
            'auto';
        });
        const autoLong = await measure();
        await page.evaluate(() =>
          document.querySelector('#scrollbar-layout-filler').remove());
        const autoShort = await measure();
        if (autoLong.clientWidth === autoShort.clientWidth) {
          t.skip('Browser uses overlay/hidden scrollbars; no measurable scrollbar width');
          return;
        }
        assert.ok(
          autoLong.clientWidth < autoShort.clientWidth,
          'Classic scrollbar reduces usable width'
        );
        assert.notEqual(
          autoLong.left,
          autoShort.left,
          'Without reserved scrollbar track centered content must shift'
        );
        await page.evaluate(() => {
          document.documentElement.style
            .overflowY = '';
        });
        assert.equal((await measure()).left, shortPage.left);
        assert.equal(
          shortPage.clientWidth,
          longPage.clientWidth,
          'Permanent scrollbar track holds layout width'
        );
        assert.equal(
          shortPage.left,
          longPage.left,
          'Permanent scrollbar track prevents centering shift'
        );
      }, scrollbarBrowser);
    } finally {
      await scrollbarBrowser.close();
    }
  }
);


test(
  'browser: opening a modal does not shift centered content when a classic scrollbar is present',
  async t => {
    // The browser harness normally hides scrollbars. Use a visible classic
    // scrollbar to detect the 15px viewport-width regression during modal lock.
    const scrollbarBrowser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
      headless: true,
      ignoreDefaultArgs: ['--hide-scrollbars'],
      args: process.env.CI || domOnly ? ['--no-sandbox'] : [],
    });
    try {
      await session(async ({page, open}) => {
        await open();
        await page.setViewportSize({width: 1366, height: 900});
        await page.evaluate(() => {
          const filler = document.createElement('div');
          filler.id = 'modal-scrollbar-probe';
          filler.style.height = '1800px';
          document.body.append(filler);
        });
        /**
         * Locates the DOM elements used by measure.
         * @return {*} Matching DOM element, if present.
         */
        const measure = () => page.evaluate(() => ({
          width: document.documentElement.clientWidth,
          centeredLeft: document.querySelector('.header-inner')
            .getBoundingClientRect().left,
          centeredWidth: document.querySelector('.header-inner')
            .getBoundingClientRect().width,
        }));
        const before = await measure();
        if (before.width === 1366) {
          t.skip('Browser uses overlay scrollbars; no physical gutter to measure');
          return;
        }
        await page.evaluate(() => window.scrollTo(0, 350));
        const scrollTop = await page.evaluate(() => window.scrollY);
        await page.evaluate(() =>
          document.querySelector('header [data-act="new"]').click());
        await page.locator('#modal-root .dialog').waitFor();
        const opened = await measure();
        assert.equal(
          opened.width,
          before.width,
          'keep the original scrollbar track'
        );
        assert.ok(Math.abs(opened.centeredLeft - before.centeredLeft) < 0.5,
          `page header must not shift on modal open: ${JSON.stringify({before, opened})}`);
        assert.ok(Math.abs(opened.centeredWidth - before.centeredWidth) < 0.5);
        assert.equal(
          await page.evaluate(() => document.documentElement.style.overflowY),
          'scroll'
        );
        await page.locator('#modal-root .dialog-head [data-act="close-modal"]').click();
        const closed = await measure();
        assert.equal(closed.width, before.width);
        assert.ok(Math.abs(closed.centeredLeft - before.centeredLeft) < 0.5);
        assert.ok(
          Math.abs(await page.evaluate(() => window.scrollY) - scrollTop) <= 1,
          'closing a modal must restore the original page scroll position'
        );
      }, scrollbarBrowser);
    } finally {
      await scrollbarBrowser.close();
    }
  }
);

test(
  'browser: mobile and desktop share theme SVGs and keep clear logo spacing',
  async () => {
    await session(async ({page, open}) => {
      await open();
      const themeButton = page.locator('header [data-act="toggle-theme"]');
      /**
       * Locates the DOM elements used by measure.
       * @return {!Promise<*>} Promise for the asynchronous operation.
       */
      const measure = async () => page.evaluate(() => {
        const logo = document.querySelector('.brand-emblem')
          .getBoundingClientRect();
        const text = document.querySelector('.brand-copy')
          .getBoundingClientRect();
        const brand = document.querySelector('.brand').getBoundingClientRect();
        const actions = document.querySelector('.top-actions')
          .getBoundingClientRect();
        const icon = document.querySelector('header [data-act="toggle-theme"] svg');
        return {
          gap: text.left - logo.right,
          brandRight: brand.right,
          actionsLeft: actions.left,
          overflow: document.body.scrollWidth > document.body
            .getBoundingClientRect().width + 1,
          iconSize: icon.getBoundingClientRect().width,
        };
      });
      const initialTheme = await page.locator('html')
        .getAttribute('data-theme');
      const firstSvg = await themeButton.locator('svg').evaluate(svg =>
        svg.outerHTML);
      await themeButton.click();
      const secondSvg = await themeButton.locator('svg').evaluate(svg =>
        svg.outerHTML);
      assert.notEqual(
        secondSvg,
        firstSvg,
        'Sun and moon must have distinct shapes'
      );
      await themeButton.click();
      assert.equal(
        await page.locator('html').getAttribute('data-theme'),
        initialTheme
      );
      for (const width of [1366, 960, 740, 450, 390, 360, 320]) {
        await page.setViewportSize({width, height: 844});
        const layout = await measure();
        assert.ok(
          layout.gap >= (width <= 380 ? 7 : width <= 450 ? 9 : 8),
          `Logo-to-wordmark spacing at ${width}px: ${layout.gap}px`
        );
        assert.ok(
          layout.brandRight + 1 <= layout.actionsLeft,
          `No overlap at ${width}px`
        );
        assert.equal(
          layout.overflow,
          false,
          `No horizontal overflow at ${width}px`
        );
        assert.equal(layout.iconSize, 19, `Identical icon size at ${width}px`);
        assert.equal(
          await themeButton.locator('svg').evaluate(svg => svg.outerHTML),
          firstSvg,
          `First theme icon is identical at ${width}px`
        );
        await themeButton.click();
        assert.equal(
          await themeButton.locator('svg').evaluate(svg => svg.outerHTML),
          secondSvg,
          `Opposite theme icon is identical at ${width}px`
        );
        await themeButton.click();
      }
    });
  }
);


test(
  'browser: header actions match hero; settings live only in the rightmost menu',
  async () => {
    await session(async ({page, open}) => {
      await open();
      await page.waitForSelector('.hero-actions');
      for (const [action, label] of [['new', 'Neue Flasche'], ['scan', 'Inventar scannen']]) {
        const headerButton = page.locator(`header [data-act="${action}"]`);
        const heroButton = page.locator(`.hero-actions [data-act="${action}"]`);
        assert.equal(await headerButton.locator('span').innerText(), label);
        assert.equal(await heroButton.locator('span').innerText(), label);
        assert.equal(await headerButton.getAttribute('aria-label'), label);
        assert.equal(await heroButton.getAttribute('aria-label'), label);
        assert.equal(
          await headerButton.locator('svg').evaluate(svg => svg.outerHTML),
          await heroButton.locator('svg').evaluate(svg => svg.outerHTML)
        );
      }
      assert.equal(
        await page.locator('header [data-act="settings"]').count(),
        0
      );
      const buttons = await page.locator('.top-actions > button')
        .evaluateAll(items => items.map(item => item.dataset.act));
      assert.deepEqual(buttons, ['toggle-theme', 'scan', 'new', 'toggle-menu']);
      await page.locator('#menu-button').click();
      const settings = page.locator('#site-drawer [data-act="goto-settings-menu"]');
      assert.equal(await settings.isVisible(), true);
      assert.equal(
        await settings.locator('svg > path').count(),
        1,
        'settings menu uses shared gear outline'
      );
      assert.equal(
        await settings.locator('svg > circle').count(),
        1,
        'settings gear retains center circle'
      );
      await settings.click();
      await page.getByRole('heading', {name: 'Einstellungen & Datensicherung'}).waitFor();
      assert.equal(
        await page.locator('.settings-heading .eyebrow.dark').innerText(),
        'DEINE SAMMLUNG VERWALTEN'
      );
      assert.equal(
        await page.locator('.settings-heading .heading-period').innerText(),
        '.'
      );
      assert.equal(
        await page.locator('.settings-heading [data-act="goto-home"]').count(),
        1
      );
      await page.setViewportSize({width: 390, height: 844});
      const settingsOverflow = await page.evaluate(() => document.body
        .scrollWidth - document.body.getBoundingClientRect().width);
      assert.ok(
        settingsOverflow <= 1,
        `Settings header must not overflow on mobile (${settingsOverflow}px)`
      );
      assert.equal(await page.locator('#menu-button').isVisible(), true);
      await page.locator('#menu-button').click();
      assert.equal(
        await page.locator('#site-drawer [data-act="goto-settings-menu"]')
          .isVisible(),
        true
      );
    });
  }
);


test(
  'browser: both themes and a narrow mobile layout render without page overflow',
  async () => {
    await session(async ({page, open}) => {
      await open();
      await page.waitForSelector('.collection-hero');
      await page.screenshot({
        path: 'test-artifacts/desktop-light.png',
      });
      const beforeTheme = await page.locator('html').getAttribute('data-theme');
      await page.locator('[data-act="toggle-theme"]').click();
      assert.notEqual(
        await page.locator('html').getAttribute('data-theme'),
        beforeTheme
      );
      await page.screenshot({
        path: 'test-artifacts/desktop-dark.png',
      });
      /**
       * Derives the sample hero background result from the supplied values.
       * @return {*} Result computed from the supplied inputs.
       */
      const sampleHeroBackground = () => page.locator('.hero-overlay')
        .evaluate(el => getComputedStyle(el).backgroundImage);
      const heroBefore = await sampleHeroBackground();
      assert.match(
        heroBefore,
        /rgba\(7, 20, 33, 0\.84\)/,
        'Hero overlay must stay dark'
      );
      await page.locator('[data-act="toggle-theme"]').click();
      assert.equal(
        await sampleHeroBackground(),
        heroBefore,
        'Hero overlay must stay dark when the theme changes'
      );
      await page.setViewportSize({
        width: 390, height: 844,
      });
      assert.equal(
        await page.locator('header [data-act="settings"]').count(),
        0,
        'settings are menu-only'
      );
      assert.equal(await page.locator('#menu-button').isVisible(), true);
      const mobileTheme = page.locator('[data-act="toggle-theme"]');
      assert.equal(
        await mobileTheme.isVisible(),
        true,
        'The mobile theme toggle must be visible'
      );
      const mobileThemeBefore = await page.locator('html')
        .getAttribute('data-theme');
      await mobileTheme.click();
      assert.notEqual(
        await page.locator('html').getAttribute('data-theme'),
        mobileThemeBefore
      );
      const heroGap = await page.evaluate(() => {
        const buttons = document.querySelector('.hero-actions')
          .getBoundingClientRect();
        const footnote = document.querySelector('.hero-footnote')
          .getBoundingClientRect();
        return footnote.top - buttons.bottom;
      });
      assert.ok(
        heroGap >= 18,
        `The EST label must be separated from buttons (gap: ${heroGap}px)`
      );
      await page.screenshot({
        path: 'test-artifacts/mobile-dark.png',
      });
      assert.ok(await page.evaluate(() => document.body.scrollWidth <=
        document.body.getBoundingClientRect().width + 1));
    });
  }
);


test(
  'browser: cards have equal heights per current grid row, but different rows can differ',
  async () => {
    await session(async ({page, base, open}) => {
      const names = [
        'A ' + 'Besonders langer Whiskyname mit mehreren Worten und vielen Angaben '.repeat(3).trim(),
        'B Kurz', 'C Kurz', 'D Kurz', 'E Kurz', 'F Kurz', 'G Kurz', 'H Kurz',
      ];
      for (let index = 0; index < names.length; index++) {
        const result = await requestJson(base, '/api/bottlings', 'POST', {
          name: names[index], ageYears: 12,
          firstBottle: {inventoryNumber: `GRID-${index}`, status: 'closed'},
        });
        assert.equal(result.status, 201);
      }
      await open();
      await page.waitForFunction(() =>
        document.querySelectorAll('.whisky-card').length === 8);
      // The same eight DOM cards must reflow into 4/3/2/1 columns without
      // changing the page size.
      for (const [width, expectedColumns] of [[1366, 4], [900, 3], [740, 2], [390, 2], [320, 1]]) {
        await page.setViewportSize({width, height: 900});
        const layout = await page.evaluate(() => {
          const grid = document.querySelector('.grid');
          const columns = getComputedStyle(grid).gridTemplateColumns
            .split(' ').length;
          const rows = [];
          for (const card of grid.querySelectorAll('.whisky-card')) {
            const rect = card.getBoundingClientRect();
            let row = rows.find(r => Math.abs(r.top - rect.top) < 1);
            if (!row) {
              row =
                {top: rect.top, heights: [], cards: []}; rows.push(row);
            }
            row.heights.push(rect.height);
            row.cards.push(card.querySelector('h3').textContent);
          }
          const first = grid.querySelector('.whisky-card');
          const title = first.querySelector('h3').getBoundingClientRect();
          const facts = first.querySelector('.card-facts')
            .getBoundingClientRect();
          return {columns, rows, gap: facts.top - title.bottom};
        });
        assert.equal(
          layout.columns,
          expectedColumns,
          `Grid columns at ${width}px`
        );
        assert.equal(layout.rows.flatMap(row => row.cards).length, 8);
        for (const row of layout.rows) {
          assert.ok(Math.max(...row.heights) - Math.min(...row.heights) < 1,
            `${width}px: cards in the same grid row must have equal heights: ${row.heights}`);
        }
        assert.ok(layout.rows[0].heights[0] > layout.rows[1].heights[0] + 10,
          `${width}px: the first (long-title) row must not force its height onto later rows`);
        assert.ok(layout.gap >= 0 && layout.gap < 10,
          `${width}px: title and facts should stay close (${layout.gap}px)`);
      }
    });
  }
);



test(
  'browser: founding year and bottler fallback work in home, table and detail after reload',
  async () => {
    await session(async ({page, open, base}) => {
      const created = await requestJson(base, '/api/bottlings', 'POST', {
        name: 'Independent bottling',
        bottler: 'Signatory Vintage',
        distilleryIds: [],
        firstBottle: {inventoryNumber: '009998', status: 'open'},
      });
      assert.equal(created.status, 201);
      await open();
      await page.locator('.whisky-card').waitFor();
      assert.match(
        await page.locator('.whisky-card .card-kicker').textContent(),
        /Signatory Vintage/
      );
      const stats = await page.locator('.stats').textContent();
      assert.match(stats, /Geöffnet/);
      assert.match(stats, /Geschlossen/);
      assert.ok(
        stats.indexOf('Geschlossen') < stats.indexOf('Geöffnet'),
        'Geschlossen must come first'
      );
      assert.doesNotMatch(stats, /Unvollständig/);
      const footerGap = await page.evaluate(() => {
        const pager = document.querySelector('.collection-pagination')
          .getBoundingClientRect();
        const footer = document.querySelector('.site-footer')
          .getBoundingClientRect();
        return footer.top - pager.bottom;
      });
      assert.ok(
        footerGap <= 55,
        `Footer must follow pagination without excessive whitespace (${footerGap}px)`
      );
      await page.locator('[data-act="toggle-view"]').click();
      assert.match(
        await page.locator('tbody tr').innerText(),
        /Signatory Vintage/
      );
      await page.locator('tbody tr').click();
      await page.locator('.detail-heading-meta').waitFor();
      assert.match(
        await page.locator('.detail-heading-meta').textContent(),
        /Signatory Vintage/
      );
      await page.locator('button[data-act="back"]').first().click();
      await openSettingsFromMenu(page);
      await page.locator('#established-year').fill('1992');
      await page.locator('#collection-settings-form button[type="submit"]')
        .click();
      await page.getByText('Gründungsjahr gespeichert', {exact: true})
        .waitFor();
      assert.equal(
        await page.locator('#established-year').inputValue(),
        '1992'
      );
      await page.locator('button[data-act="goto-home"]').first().click();
      await page.locator('.hero-footnote').waitFor();
      assert.match(
        await page.locator('.hero-footnote').innerText(),
        /COLLECTION · EST\. 1992/
      );
      if (!domOnly) {
        await page.reload();
        await page.locator('.hero-footnote').waitFor();
        assert.match(
          await page.locator('.hero-footnote').innerText(),
          /COLLECTION · EST\. 1992/
        );
      }
    });
  }
);



test('browser: real back/forward navigation and direct reload', {
  skip: domOnly ? 'Managed environment: only DOM mode available; history controller is unit-tested separately' : false,
}, async () => {
  await session(async ({page, base, open}) => {
    const data = await seed(base);
    await open();
    await page.locator('.whisky-card').click();
    await page.waitForURL(`**/?bottling=${data.bottling.id}`);
    await openSettingsFromMenu(page);
    await page.waitForURL('**/?view=settings');
    await page.goBack();
    await page.waitForSelector('[data-act="edit-bottling"]');
    await page.goForward();
    await page.waitForURL('**/?view=settings');
    await page.getByRole('heading', {name: 'Einstellungen & Datensicherung'}).waitFor();
    // Import/export is a separate settings panel; the legacy JSON import
    // inside it remains in a closed <details> until the user opens it.
    await openSettingsSection(page, 'transfer');
    await page.locator('details:has(#import-file) > summary').click();
    await page.locator('#import-file').waitFor({state: 'visible'});
    await page.goto(`${base}/?bottling=${data.bottling.id}`);
    await page.reload();
    await page.waitForSelector('[data-act="edit-bottling"]');
    assert.equal(
      await page.locator('.section-head h2').innerText(),
      'Browser Test Blend'
    );
  });
});



test(
  'browser: overview and detail mark individual samples, not the bottling itself',
  async () => {
    await session(async ({page, open, base}) => {
      const created = await seed(base);
      const sample = await requestJson(base, '/api/bottles', 'POST', {
        bottlingId: created.bottling.id,
        inventoryNumber: '000124',
        volumeType: 'sample',
        volumeMl: 30,
      });
      assert.equal(sample.status, 201);
      await open();
      await page.waitForSelector('.whisky-card .badge.sample');
      const badges = page.locator('.whisky-card .card-body > .badges');
      assert.match(await badges.innerText(), /1 Standardflasche/);
      assert.match(await badges.innerText(), /1 Sample/);
      assert.doesNotMatch(await badges.innerText(), /2 Flaschen/);
      await page.locator('[data-act="toggle-view"]').click();
      const tableCounts = page.locator('tbody .inventory-badges');
      assert.match(await tableCounts.innerText(), /1 Standardflasche/);
      assert.match(await tableCounts.innerText(), /1 Sample/);
      assert.doesNotMatch(await tableCounts.innerText(), /2 Flaschen/);
      await page.locator('tbody tr').first().click();
      await page.waitForSelector(`#bottle-${sample.data.id} .badge.sample`);
      assert.equal(
        await page.locator(`#bottle-${created.bottle.id} .badge.sample`)
          .count(),
        0
      );
      assert.match(
        await page.locator(`#bottle-${sample.data.id}`).innerText(),
        /30 ml/
      );
      // The sample badge must not touch the status badge or show a border.
      for (const theme of ['light', 'dark']) {
        const metrics = await page.evaluate(({id, theme}) => {
          document.documentElement.dataset.theme = theme;
          const info = document.getElementById(`bottle-${id}`);
          const status =
            info.querySelector('.bottle-entry-identity > .badge.closed');
          const sample =
            info.querySelector('.bottle-entry-identity > .badge.sample');
          const statusRect = status.getBoundingClientRect();
          const sampleRect = sample.getBoundingClientRect();
          return {
            gap: sampleRect.left - statusRect.right,
            borderWidth: getComputedStyle(sample).borderTopWidth,
          };
        }, {id: sample.data.id, theme});
        assert.ok(
          metrics.gap >= 10,
          `${theme}: gap must be at least 10px, got ${metrics.gap}px`
        );
        assert.equal(
          metrics.borderWidth,
          '0px',
          `${theme}: sample badge must have no border`
        );
      }
      await page.locator(`#bottle-${sample.data.id} [data-act="edit-bottle"]`)
        .click();
      assert.equal(
        await page.locator('#bottle-form [name="volumeType"]').inputValue(),
        'sample'
      );
      assert.equal(
        await page.locator('#bottle-form [name="volumeMl"]').inputValue(),
        '30'
      );
    });
  }
);



test('browser: upload and remove invoice for one physical bottle', async () => {
  await session(async ({page, base, open}) => {
    const data = await seed(base, '000931');
    await open();
    await page.locator('.whisky-card').click();
    const files = page.locator(`#bottle-${data.bottle
      .id} input[data-bottle-files]`);
    // Verify the actual upload response before waiting for the refreshed DOM.
    // Otherwise a rejected upload is misreported as a generic selector timeout.
    const uploaded = page.waitForResponse(response =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === `/api/bottles/${data.bottle
        .id}/files`);
    await files.setInputFiles({
      name: 'Rechnung.pdf', mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n'),
    });
    const uploadResponse = await uploaded;
    assert.equal(uploadResponse.status(), 201,
      `attachment upload must succeed: ${await uploadResponse.text()}`);
    await page.waitForSelector(`#bottle-${data.bottle
      .id} .document-preview-link`);
    assert.equal(
      await page.locator('.document-preview-link').innerText(),
      'Rechnung.pdf'
    );
    const saved = (await requestJson(base, '/api/collection')).data;
    assert.equal(saved.bottlings[0].bottles[0].files.length, 1);
    const download = page.locator('.document-download');
    assert.match(
      await download.getAttribute('href'),
      new RegExp(`/api/bottles/${data.bottle.id}/files/`)
    );
    assert.equal(await download.getAttribute('download'), 'Rechnung.pdf');
    await page.locator(`#bottle-${data.bottle
      .id} [data-act="preview-file"]`).click();
    await page.locator('#modal-root .document-preview-pdf').waitFor();
    const iframe = page.locator('#modal-root .document-preview-pdf');
    assert.match(
      await iframe.getAttribute('src'),
      new RegExp(`^/api/bottles/${data.bottle.id}/files/[\\w-]+/preview$`)
    );
    assert.equal(await iframe.getAttribute('sandbox'), null,
      'Chrome PDF viewer must not be blocked by iframe sandbox restrictions');
    assert.equal(
      await page.locator('#modal-root .document-preview-actions a[download="Rechnung.pdf"]').count(),
      1
    );
    await page.locator('#modal-root [data-act="close-modal"]').click();
    await page.locator(`#bottle-${data.bottle.id} [data-act="delete-file"]`)
      .click();
    await page.locator('.overlay [data-act="confirm-action"]').click();
    await page.waitForSelector('.document-list', {state: 'detached'});
    const after = (await requestJson(base, '/api/collection')).data;
    assert.deepEqual(after.bottlings[0].bottles[0].files, []);
  });
});



test(
  'browser: attachments preview images and safe plaintext, with download fallback for office files',
  async () => {
    await session(async ({page, base, open}) => {
      const {bottling, bottle} = await seed(base, '000936');
      const uploads = [
        {
          name: 'proof.png',
          mime: 'image/png',
          bytes: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=',
            'base64'
          ),
        },
        {
          name: 'memo.txt',
          mime: 'text/plain',
          bytes: Buffer.from('<script>alert("not HTML")</script>\nOriginal receipt'),
        },
        {
          name: 'letter.docx',
          mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          bytes: Buffer.from('504b030400000000', 'hex'),
        },
      ];
      for (const file of uploads) {
        const res = await requestJson(
          base,
          `/api/bottles/${bottle.id}/files`,
          'POST',
          {
            filename: file.name,
            data: `data:${file.mime};base64,${file.bytes.toString('base64')}`,
          }
        );
        assert.equal(res.status, 201, file.name);
      }
      await open({query: `?bottling=${bottling.id}`});
      /**
       * Performs the open preview lifecycle action.
       *
       * @param {*} name Environment variable or setting name.
       * @return {*} Entries that meet the selection criteria.
       */
      const openPreview = name =>
        page.locator(`#bottle-${bottle.id} [data-act="preview-file"]`)
          .filter({hasText: name}).click();
      await openPreview('proof.png');
      await page.locator('#modal-root .document-preview-image').waitFor();
      assert.match(
        await page.locator('#modal-root .document-preview-image')
          .getAttribute('src'),
        /^blob:/
      );
      assert.equal(
        await page.locator('#modal-root .document-preview-actions [download="proof.png"]').count(),
        1
      );
      await page.locator('#modal-root [data-act="close-modal"]').click();
      await openPreview('memo.txt');
      await page.locator('#modal-root .document-preview-text').waitFor();
      assert.match(
        await page.locator('#modal-root .document-preview-text').innerText(),
        /Original receipt/
      );
      assert.equal(
        await page.locator('#modal-root .document-preview-text script').count(),
        0,
        'Untrusted text must not become executable HTML'
      );
      await page.locator('#modal-root [data-act="close-modal"]').click();
      await openPreview('letter.docx');
      assert.match(
        await page.locator('#modal-root .document-preview-stage').innerText(),
        /keine Vorschau verfügbar/
      );
      assert.equal(
        await page.locator('#modal-root .document-preview-actions [download="letter.docx"]').count(),
        1
      );
      await page.locator('#modal-root [data-act="close-modal"]').click();
    });
  }
);

test(
  'browser: removing a photo or attachment does not bounce the detail page to the top',
  async () => {
    await session(async ({page, base, open}) => {
      const {bottling, bottle} = await seed(base, '002286');
      const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=';
      for (let i = 0; i < 8; i++) {
        assert.equal(
          (await requestJson(
            base,
            `/api/bottles/${bottle.id}/photos`,
            'POST',
            {image: png}
          )).status,
          201
        );
      }
      await open({query: `?bottling=${bottling.id}`});
      await page.locator('.photo-tile').first().waitFor();
      const invoice = page.locator(`[data-bottle-files="${bottle.id}"]`);
      const uploaded = page.waitForResponse(response => response.request()
        .method() === 'POST' &&
        new URL(response.url()).pathname === `/api/bottles/${bottle.id}/files`);
      await invoice.setInputFiles({
        name: 'receipt.pdf', mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n'),
      });
      assert.equal((await uploaded).status(), 201);
      await page.locator('.document-list a').waitFor();
      await page.evaluate(() => {
        window.__coverBefore =
          document.querySelector('.detail-summary-grid .hero-photo');
      });
      // Keep room below the content: when a deletion shortens a page that is
      // scrolled to its very end, the browser must clamp scrollY. That is
      // correct behaviour, not a bounce, so the probe must not sit at the end.
      await page.evaluate(() => {
        const spacer = document.createElement('div');
        spacer.id = 'scroll-room-probe';
        spacer.style.height = '1200px';
        document.body.append(spacer);
      });

      // Observe complete animation frames after unlocking the confirmation
      // dialog. A scroll-to-top followed by smooth restoration must fail.
      /**
       * Locates the DOM elements used by confirm and check.
       *
       * @param {function(...*): *} selector Selector used to obtain matching
       *     values.
       * @param {*} expectedSelector Value used by this operation.
       * @param {*} expectedCount Value used by this operation.
       * @return {!Promise<*>} Promise for the asynchronous operation.
       */
      async function confirmAndCheck(selector, expectedSelector, expectedCount) {
        const trigger = selector === 'photo' ?
          page.locator('[data-act="delete-photo"]').nth(4)
          : selector === 'cover' ?
            page.locator('[data-act="delete-photo"]').first()
            : page.locator(selector);
        await trigger.click();
        await page.locator('#modal-root [data-act="confirm-action"]').waitFor();
        const previous = await page.evaluate(() => ({
          y: -Number.parseInt(document.body.style.top, 10),
          cardTop: document.querySelector('.bottle-entry')
            .getBoundingClientRect().top,
        }));
        assert.ok(
          previous.y > 100,
          'the confirmation must start from a scrolled detail page'
        );
        await page.evaluate(() => {
          window.__scrollSamples = [];
          window.__stopScrollSamples = false;
          /**
           * Locates the DOM elements used by sample.
           */
          const sample = () => {
            window.__scrollSamples.push({
              y: window.scrollY,
              fixed: document.body.style.position === 'fixed',
              cardTop: document.querySelector('.bottle-entry')?.getBoundingClientRect().top,
            });
            if (!window.__stopScrollSamples) requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        });
        await page.locator('#modal-root [data-act="confirm-action"]').click();
        await page.waitForFunction(
          ({selector, count}) => document.querySelectorAll(selector)
            .length === count,
          {selector: expectedSelector, count: expectedCount}
        );
        await page.waitForTimeout(120);
        const samples = await page.evaluate(() => {
          window.__stopScrollSamples = true;
          return window.__scrollSamples.filter(sample => !sample.fixed);
        });
        assert.ok(
          samples.length,
          'scroll positions must be observed after closing the dialog'
        );
        assert.ok(samples.every(sample => sample.y >= previous.y - 125),
          `same-page refresh must not jump to top: ${JSON.stringify(samples)}`);
        assert.ok(
          samples.every(sample => Math.abs(sample.cardTop -
            previous.cardTop) <= 3),
          `visible bottle card must not move while saving: ${JSON.stringify(samples)}`
        );
      }
      await page.locator('.photo-tile').nth(4).scrollIntoViewIfNeeded();
      await confirmAndCheck('photo', '.photo-tile', 7);
      assert.equal(
        await page.evaluate(() => window.__coverBefore ===
          document.querySelector('.detail-summary-grid .hero-photo')),
        true,
        'unchanged cover image must remain mounted'
      );
      // Deleting the cover must also keep the upper photo area stable while
      // the next image is decoded, rather than shifting the entire page.
      await page.locator('.photo-tile').first().scrollIntoViewIfNeeded();
      await confirmAndCheck('cover', '.photo-tile', 6);
      await page.locator('[data-act="delete-file"]').scrollIntoViewIfNeeded();
      await confirmAndCheck('[data-act="delete-file"]', '.document-list a', 0);
      assert.equal(await page.locator('.photo-tile').count(), 6);
    });
  }
);



test('browser: six bottlings still use four columns on desktop', async () => {
  await session(async ({page, base, open}) => {
    const collection = (await requestJson(base, '/api/collection')).data;
    collection.bottlings = Array.from({length: 6}, (_, index) => ({
      id: `six-${index + 1}`,
      name: `Six Malt ${index + 1}`,
      distilleryIds: [], bottles: [], tastings: [],
      createdAt: '2026-11-06T08:00:00.000Z',
    }));
    assert.equal(
      (await requestJson(base, '/api/import/json', 'POST', collection)).status,
      200
    );
    await open();
    assert.equal(await page.locator('.whisky-card').count(), 6);
    const layout = await page.locator('.grid').evaluate(el => {
      const css = getComputedStyle(el);
      const title = getComputedStyle(el.querySelector('.card-body h3'));
      return {
        display: css.display,
        columns: css.gridTemplateColumns.split(' ').length,
        align: css.alignItems,
        autoRows: css.gridAutoRows,
        titleMinHeight: title.minHeight,
      };
    });
    assert.deepEqual(
      layout,
      {
        display: 'grid',
        columns: 4,
        align: 'stretch',
        autoRows: 'auto',
        titleMinHeight: '0px',
      }
    );
    assert.equal(await page.locator('#pagination-size').inputValue(), '24');
  });
});



test(
  'browser: selected entries per page survive F5 in both collection modes',
  async () => {
    if (domOnly) return; // Actual F5 requires navigation, not the DOM-only test harness.
    await session(async ({page, base, open}) => {
      const source = await requestJson(base, '/api/collection');
      const collection = source.data;
      collection.bottlings = Array.from({length: 75}, (_, index) => ({
        id: `persist-${index + 1}`,
        name: `Malt ${index + 1}`,
        distilleryIds: [], tastings: [], bottles: [{
          id: `bottle-persist-${index + 1}`,
          inventoryNumber: String(index + 1),
          status: 'closed',
          volumeType: 'standard',
        }],
        createdAt: '2026-11-06T08:00:00.000Z',
      }));
      assert.equal(
        (await requestJson(base, '/api/import/json', 'POST', collection)).status,
        200
      );
      await open();
      await page.locator('#pagination-size').selectOption('48');
      assert.equal(await page.locator('.whisky-card').count(), 48);
      assert.equal(
        await page.evaluate(() => localStorage.getItem('whisky-page-size')),
        '48'
      );
      await page.reload();
      await page.locator('#pagination-size').waitFor();
      assert.equal(await page.locator('#pagination-size').inputValue(), '48');
      assert.equal(await page.locator('.whisky-card').count(), 48);
      await page.locator('[data-collection-mode="bottles"]').click();
      assert.equal(await page.locator('#pagination-size').inputValue(), '48');
      await page.reload();
      await page.locator('#pagination-size').waitFor();
      assert.equal(await page.locator('#pagination-size').inputValue(), '48');
      await page.locator('#pagination-size').selectOption('12');
      await page.reload();
      await page.locator('#pagination-size').waitFor();
      assert.equal(await page.locator('#pagination-size').inputValue(), '12');
      assert.equal(await page.locator('.whisky-card').count(), 12);
    });
  }
);



test(
  'browser: 450 bottlings keep a fixed page size with only divisor-friendly grid widths',
  async () => {
    await session(async ({page, base, open}) => {
      const source = await requestJson(base, '/api/collection');
      const collection = source.data;
      collection.bottlings = Array.from({length: 450}, (_, index) => ({
        id: `bulk-${String(index + 1).padStart(4, '0')}`,
        name: `Malt ${String(index + 1).padStart(4, '0')}`,
        distilleryIds: [],
        bottles: [], tastings: [],
        createdAt: '2026-11-06T08:00:00.000Z',
      }));
      const result = await requestJson(base, '/api/import/json', 'POST', collection);
      assert.equal(result.status, 200);
      await open();
      await page.waitForSelector('.collection-pagination');
      await page.waitForFunction(() =>
        document.querySelectorAll('.whisky-card').length === 24);
      assert.equal(
        await page.locator('.grid').evaluate(el => getComputedStyle(el)
          .gridTemplateColumns.split(' ').length),
        4
      );
      assert.equal(await page.locator('.whisky-card').count(), 24);
      assert.match(
        await page.locator('.pagination-topline').innerText(),
        /Seite 1 von 19/
      );
      assert.equal(await page.locator('#pagination-size').inputValue(), '24');

      // 24 remains 24 even when the grid changes 2 -> 3 -> 4 columns.
      for (const [width, columns] of [[390, 2], [820, 3], [1366, 4], [1660, 4], [360, 1]]) {
        await page.setViewportSize({width, height: 900});
        assert.equal(
          await page.locator('.grid').evaluate(el => getComputedStyle(el)
            .gridTemplateColumns.split(' ').length),
          columns
        );
        assert.equal(await page.locator('.whisky-card').count(), 24);
      }

      // The numbered last page and the "Letzte Seite" button both target page
      // 19.
      // Select the numbered button by its unique accessible name.
      await page.locator('.pagination-pages [aria-label="Seite 19"]').click();
      assert.equal(await page.locator('.whisky-card').count(), 18);
      assert.equal(
        await page.locator('.grid').evaluate(el => getComputedStyle(el)
          .gridTemplateColumns.split(' ').length),
        1
      );
      assert.match(
        await page.locator('.pagination-topline').innerText(),
        /433–450 von 450/
      );
      if (domOnly) {
        assert.ok(await page.evaluate(() => window.__historyCalls.some(call =>
          call.url === '/?page=19')));
      } else {
        await page.waitForURL('**/?page=19');
      }
      await page.setViewportSize({width: 1660, height: 900});
      assert.equal(
        await page.locator('.grid').evaluate(el => getComputedStyle(el)
          .gridTemplateColumns.split(' ').length),
        4
      );
      await page.locator('#search').fill('Malt 044');
      // Search leaves 10 results, not necessarily a complete row; no six-column
      // squeeze.
      assert.equal(await page.locator('.whisky-card').count(), 10);
      assert.equal(
        await page.locator('.grid').evaluate(el => getComputedStyle(el)
          .gridTemplateColumns.split(' ').length),
        4
      );
      await page.locator('#search').fill('Malt 0450');
      assert.equal(await page.locator('.whisky-card').count(), 1);
      assert.match(await page.locator('.whisky-card').innerText(), /Malt 0450/);
      assert.equal(
        await page.locator('.pagination-summary').innerText(),
        '1–1 von 1 Abfüllungen'
      );
      await page.locator('#search').fill('');
      await page.locator('[data-act="toggle-view"]').click();
      assert.equal(
        await page.locator('tbody tr').count(),
        24,
        'table respects the same fixed 24 entries'
      );
      await page.locator('[data-act="toggle-view"]').click();
      assert.equal(await page.locator('#pagination-size').inputValue(), '24');
      await page.locator('#pagination-size').selectOption('48');
      assert.equal(await page.locator('.whisky-card').count(), 48);
      await page.locator('#pagination-size').selectOption('12');
      assert.equal(await page.locator('.whisky-card').count(), 12);
      await page.locator('#pagination-size').selectOption('24');
      await page.locator('.pagination-pages [aria-label="Seite 19"]').click();
      assert.match(
        await page.locator('.pagination-topline').innerText(),
        /433–450 von 450/
      );
      assert.equal(await page.locator('.whisky-card').count(), 18);
    });
  }
);



test(
  'browser: distillery management uses normal page scrolling and app dialogs for create and rename',
  async () => {
    await session(async ({page, base, open}) => {
      await open();
      await openSettingsFromMenu(page);
      await openSettingsSection(page, 'distilleries');
      const metrics = await page.locator('.distillery-list').evaluate(el => ({
        maxHeight: getComputedStyle(el).maxHeight,
        scrolling: getComputedStyle(el).overflowY,
        rowCount: el.querySelectorAll('.distillery-row').length,
        height: el.getBoundingClientRect().height,
      }));
      assert.equal(
        metrics.maxHeight,
        'none',
        'distilleries must not have a fixed height cap'
      );
      assert.equal(
        metrics.scrolling,
        'visible',
        'the page, not the list, should scroll'
      );
      assert.ok(
        metrics.rowCount > 100 && metrics.height > 400,
        'all distilleries remain in the full-height list'
      );
      await page.locator('#distillery-search').fill('Ardbeg');
      assert.equal(await page.locator('.distillery-row:visible').count(), 1);
      assert.match(
        await page.locator('#distillery-count').innerText(),
        /1 von/
      );
      await page.locator('.distillery-row:visible [data-act="rename-distillery"]').click();
      assert.equal(
        await page.locator('#distillery-name').inputValue(),
        'Ardbeg'
      );
      const labelGaps = await page.locator('#distillery-form')
        .evaluate(form => {
          const nameBottom = form.querySelector('#distillery-name')
            .getBoundingClientRect().bottom;
          const statusLabel = form.querySelector('#distillery-status')
            .closest('label');
          const statusBottom = form.querySelector('#distillery-status')
            .getBoundingClientRect().bottom;
          const coordinatesLabel = form.querySelector('#distillery-latitude')
            .closest('label');
          return [statusLabel.getBoundingClientRect().top - nameBottom,
          coordinatesLabel.getBoundingClientRect().top - statusBottom];
        });
      assert.ok(
        labelGaps.every(gap => gap >= 12),
        `distillery labels need vertical separation: ${labelGaps}`
      );
      await page.locator('#distillery-name').fill('Ardbeg Test Edition');
      await page.locator('#distillery-form button[type="submit"]').click();
      await page.waitForSelector('.overlay', {state: 'detached'});
      await page.locator('#distillery-search').fill('Ardbeg Test Edition');
      assert.equal(await page.locator('.distillery-row:visible').count(), 1);
      const renamed = (await requestJson(base, '/api/collection')).data
        .distilleries;
      assert.ok(renamed.some(d => d.name === 'Ardbeg Test Edition'));
      await page.locator('[data-act="add-distillery"]').first().click();
      await page.locator('#distillery-name').fill('Sample New Distillery');
      await page.locator('#distillery-form button[type="submit"]').click();
      await page.waitForSelector('.overlay', {state: 'detached'});
      assert.ok((await requestJson(base, '/api/collection')).data.distilleries
        .some(d => d.name === 'Sample New Distillery'));
    });
  }
);



test(
  'browser: adding a distillery within a bottling form restores unsaved fields and selected files',
  async () => {
    await session(async ({page, open}) => {
      await open();
      await page.locator('[data-act="new"]').first().click();
      await page.locator('#bottling-form [name="name"]')
        .fill('My unfinished bottling');
      await page.locator('#bottling-form [name="brand"]')
        .fill('My unfinished brand');
      await page.locator('#bottling-form [name="firstPhotos"]').setInputFiles({
        name: 'snapshot.png', mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=',
          'base64'
        ),
      });
      await page.locator('#bottling-form [data-act="add-distillery"]').click();
      await page.waitForSelector('#distillery-form');
      assert.equal(
        await page.locator('#bottling-form').count(),
        0,
        'parent form must be temporarily suspended'
      );
      await page.locator('#distillery-name').fill('New Distillery in Draft');
      await page.locator('#distillery-form button[type="submit"]').click();
      await page.waitForSelector('#bottling-form');
      assert.equal(
        await page.locator('#bottling-form [name="name"]').inputValue(),
        'My unfinished bottling'
      );
      assert.equal(
        await page.locator('#bottling-form [name="brand"]').inputValue(),
        'My unfinished brand'
      );
      assert.equal(
        await page.locator('#bottling-form [name="firstPhotos"]')
          .evaluate(el => el.files[0]?.name),
        'snapshot.png'
      );
      const selection = page.locator('#bottling-form .distillery-option')
        .filter({hasText: 'New Distillery in Draft'});
      assert.equal(await selection.locator('input:checked').count(), 1);
    });
  }
);



test(
  'browser: existing overview photos keep a visible gap above the divider',
  async () => {
    await session(async ({page, open, base}) => {
      const {bottle} = await seed(base, '000912');
      await requestJson(base, `/api/bottles/${bottle.id}/photos`, 'POST', {
        image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=',
      });
      await open();
      for (const width of [1366, 390, 350]) {
        await page.setViewportSize({width, height: 850});
        const spacing = await page.locator('.card-img img:not(.image-placeholder)').evaluate(el => {
          const image = getComputedStyle(el);
          const card = el.closest('.card-img');
          const rule = getComputedStyle(card, '::after');
          return {
            padding: parseFloat(image.paddingBottom),
            ruleBottom: parseFloat(rule.bottom),
          };
        });
        // The line is 13px from the card bottom; the image padding must be
        // greater than that to avoid any visible pixels touching the line.
        assert.ok(
          spacing.padding - spacing.ruleBottom >= 8,
          `${width}px: photo needs >8px gap above rule`
        );
      }
    });
  }
);



test(
  'browser: switch between bottlings and physical bottles, filter, navigate and restore the mode',
  async () => {
    await session(async ({page, base, open}) => {
      const created = await seed(base, '000701');
      const added = await requestJson(base, '/api/bottles', 'POST', {
        bottlingId: created.bottling.id, inventoryNumber: '000702',
        volumeType: 'sample', volumeMl: 50, status: 'open',
      });
      assert.equal(added.status, 201);
      const photo = await requestJson(
        base,
        `/api/bottles/${created.bottle.id}/photos`,
        'POST',
        {
          image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fG8AAAAASUVORK5CYII=',
        }
      );
      assert.equal(photo.status, 201);
      await open();
      assert.equal(await page.locator('.whisky-card').count(), 1);
      const head = page.locator('.collection-heading');
      assert.equal(await head.locator('.collection-mode-toggle').count(), 1);
      assert.equal(await page.locator('.collection-mode-toggle').count(), 1);
      for (const width of [320, 390, 740, 900, 1366]) {
        await page.setViewportSize({width, height: 850});
        const layout = await head.locator('.collection-mode-toggle')
          .evaluate((el) => {
            const rect = el.getBoundingClientRect();
            const stats = document.querySelector('.stats')
              .getBoundingClientRect();
            return {
              left: rect.left,
              right: rect.right,
              bottom: rect.bottom,
              statsTop: stats.top,
            };
          });
        assert.ok(
          layout.left >= 0 && layout.right <= width + 1,
          `${width}px: toggle must fit the viewport`
        );
        assert.ok(
          layout.bottom <= layout.statsTop,
          `${width}px: toggle must stay above statistics`
        );
      }
      await page.setViewportSize({width: 1366, height: 900});
      await page.locator('[data-collection-mode="bottles"]').click();
      assert.equal(await page.locator('.whisky-card').count(), 2);
      const firstSrc = await page.locator(`.whisky-card[data-bottle-id="${created.bottle.id}"] .card-img img`).getAttribute('src');
      const secondSrc = await page.locator(`.whisky-card[data-bottle-id="${added.data.id}"] .card-img img`).getAttribute('src');
      assert.ok(
        firstSrc && !firstSrc.includes('photo-placeholder'),
        'The first bottle has its own photo'
      );
      assert.equal(
        secondSrc,
        firstSrc,
        'A bottle without its own photo uses the bottling cover'
      );
      assert.equal(
        await page.locator('[data-collection-mode="bottles"]')
          .getAttribute('aria-pressed'),
        'true'
      );
      assert.match(await page.locator('.grid').innerText(), /000701/);
      assert.match(await page.locator('.grid').innerText(), /000702/);
      if (!domOnly) {
        assert.equal(new URL(page.url()).searchParams.get('mode'), 'bottles');
        await page.goBack();
        assert.equal(await page.locator('.whisky-card').count(), 1);
        await page.goForward();
        assert.equal(await page.locator('.whisky-card').count(), 2);
        await page.reload();
        await page.locator('.whisky-card').nth(1).waitFor();
        assert.equal(await page.locator('.whisky-card').count(), 2);
      }
      await page.locator('#filter-status').selectOption('open');
      assert.equal(await page.locator('.whisky-card').count(), 1);
      assert.match(await page.locator('.whisky-card').innerText(), /000702/);
      await page.locator('#filter-status').selectOption('all');
      await page.locator('#search').fill('000701');
      assert.equal(await page.locator('.whisky-card').count(), 1);
      assert.match(await page.locator('.whisky-card').innerText(), /000701/);
      await page.locator('#search').fill('');
      await page.locator('[data-act="toggle-view"]').click();
      assert.equal(await page.locator('tbody tr[data-bottle-id]').count(), 2);
      assert.match(await page.locator('thead').innerText(), /Flasche/i);
      await page.locator('[data-act="toggle-view"]').click();
      await page.locator(`.whisky-card[data-bottle-id="${added.data.id}"]`)
        .click();
      await page.waitForSelector(`#bottle-${added.data.id}.scanned-bottle`);
      await page.locator('[data-act="back"]').first().click();
      assert.equal(await page.locator('.whisky-card').count(), 2);
      assert.equal(
        await page.locator('[data-collection-mode="bottles"]')
          .getAttribute('aria-pressed'),
        'true'
      );
      await page.locator('[data-collection-mode="bottlings"]').click();
      assert.equal(await page.locator('.whisky-card').count(), 1);
    });
  }
);



test(
  'browser: overview quick filters list only used distilleries and combine standard bottles and samples',
  async () => {
    await session(async ({page, base, open}) => {
      const catalog = (await requestJson(base, '/api/collection')).data
        .distilleries;
      const first = catalog.find(item => item.name === 'Kilchoman');
      const second = catalog.find(item => item.name === 'Aberfeldy');
      assert.ok(first && second);
      for (const [name, id, number] of [
        ['Quickfilter Kilchoman', first.id, '086001'],
        ['Quickfilter Aberfeldy', second.id, '086002'],
      ]) {
        const created = await requestJson(base, '/api/bottlings', 'POST', {
          name,
          distilleryIds: [id],
          firstBottle: {inventoryNumber: number, status: 'closed'},
        });
        assert.equal(created.status, 201);
        if (id === first.id) {
          const added = await requestJson(base, '/api/bottles', 'POST', {
            bottlingId: created.data.bottling.id, inventoryNumber: '086003',
            volumeType: 'sample', status: 'open',
          });
          assert.equal(added.status, 201);
        }
      }
      await open();
      await page.locator('[data-act="toggle-collection-filters"]').click();
      assert.deepEqual(
        await page.locator('#filter-distillery option').allTextContents(),
        ['Alle Destillerien', 'Aberfeldy', 'Kilchoman']
      );
      await page.locator('#filter-distillery').selectOption(first.id);
      await page.locator('#filter-volume-type').selectOption('sample');
      assert.equal(await page.locator('.whisky-card').count(), 1);
      assert.match(
        await page.locator('.whisky-card').innerText(),
        /Quickfilter Kilchoman/
      );
      await page.locator('#filter-status').selectOption('closed');
      assert.equal(await page.locator('.whisky-card').count(), 0,
        'the closed standard bottle must not qualify as a closed sample');
      await page.locator('#filter-status').selectOption('open');
      assert.equal(await page.locator('.whisky-card').count(), 1);
      await page.locator('[data-collection-mode="bottles"]').click();
      assert.equal(
        await page.locator('#filter-distillery').inputValue(),
        first.id
      );
      assert.equal(
        await page.locator('#filter-volume-type').inputValue(),
        'sample'
      );
      assert.equal(await page.locator('.whisky-card').count(), 1);
      assert.match(await page.locator('.whisky-card').innerText(), /086003/);
      await page.locator('#filter-volume-type').selectOption('standard');
      assert.equal(await page.locator('.whisky-card').count(), 0);
      await page.locator('#filter-status').selectOption('all');
      assert.equal(await page.locator('.whisky-card').count(), 1);
      assert.match(await page.locator('.whisky-card').innerText(), /086001/);
      await page.locator('[data-act="toggle-view"]').click();
      assert.equal(await page.locator('tbody tr').count(), 1);
      await page.locator('#filter-distillery').selectOption(second.id);
      assert.match(await page.locator('tbody').innerText(), /086002/);
      for (const width of [320, 390, 1366]) {
        await page.setViewportSize({width, height: 850});
        const overflow = await page.evaluate(() => document.body.scrollWidth -
          document.body.getBoundingClientRect().width);
        assert.ok(
          overflow <= 1,
          `${width}px: overview quick filters must not overflow`
        );
        const layout = await page.locator('.collection-filters')
          .evaluate(toolbar => {
            // The flavor filter is a <summary> on desktop and a modal button
            // on mobile. Exactly one of those two controls must be visible.
            const controls = [...toolbar.querySelectorAll(
              'input#search, select, button.btn, .collection-flavor-picker > summary'
            )];
            return controls.filter(element => element.getClientRects().length >
              0).map(element => ({
                id: element.id || element.dataset.act ||
                  (element.matches('.collection-flavor-trigger') ?
                    'collection-flavor-trigger' : ''),
                top: element.getBoundingClientRect().top,
                height: element.getBoundingClientRect().height,
              }));
          });
        // Assert the actual controls, not an exact total: future additions
        // must not invalidate an otherwise accessible filter toolbar.
        for (const id of [
          'search', 'filter-sort', 'filter-status', 'filter-completion',
          'toggle-collection-filters', 'toggle-view',
          'filter-distillery', 'filter-rating', 'filter-volume-type',
        ]) {
          assert.equal(layout.filter(item => item.id === id).length, 1,
            `${width}px: ${id} is visible exactly once`);
        }
        assert.equal(
          layout.filter(item =>
            item.id === 'collection-flavor-trigger' || item.id ===
            'collection-flavor-open').length,
          1,
          `${width}px: exactly one flavor filter trigger is visible`
        );
        assert.ok(layout.every(item => Math.abs(item.height - 44) <= 1),
          `${width}px: all visible controls including More filters and flavor must be 44px high`);
        if (width === 1366) {
          assert.equal(
            layout[0].top,
            layout[1].top,
            'desktop: search and sort share the top row'
          );
          assert.ok(
            layout[2].top > layout[0].top,
            'desktop: status is on the second row'
          );
        }
      }
    });
  }
);





test(
  'browser: horizontal overflow check detects an 8px overflow with a reserved scrollbar track',
  async () => {
    await session(async ({page, open}) => {
      await open();
      await page.setViewportSize({width: 320, height: 900});
      const measurement = await page.evaluate(() => {
        // The browser may report the full viewport through clientWidth even
        // though the real body layout ends at the scrollbar track.
        const body = document.body;
        const usableWidth = body.getBoundingClientRect().width;
        const normalOverflow = body.scrollWidth - usableWidth;
        const probe = document.createElement('div');
        // Use an in-flow box: absolute positioning can make scrollWidth
        // measurements differ between the root and body scroll containers.
        probe.style.cssText = `display:block;width:${usableWidth +
          8}px;height:1px;pointer-events:none`;
        body.append(probe);
        const withOverflow = body.scrollWidth -
          body.getBoundingClientRect().width;
        const visualExcess = probe.getBoundingClientRect().right -
          body.getBoundingClientRect().right;
        probe.remove();
        return {usableWidth, normalOverflow, withOverflow, visualExcess};
      });
      assert.ok(measurement.usableWidth > 0 && measurement.usableWidth <= 320);
      assert.ok(
        measurement.normalOverflow <= 1,
        `Baseline layout overflow: ${JSON.stringify(measurement)}`
      );
      assert.ok(measurement.visualExcess >= 7,
        `Probe must extend 8px beyond the usable body layout: ${JSON.stringify(measurement)}`);
      assert.ok(measurement.withOverflow >= 7,
        `8px overflow must be detected with a reserved scrollbar track: ${JSON.stringify(measurement)}`);
    });
  }
);

test(
  'browser: a committed bottling is not created twice after the following warehouse GET fails',
  async () => {
    await session(async ({page, open, base}) => {
      await open();
      const name = 'Persisted despite one refresh failure';
      // Initial load completed; fail only the next read after POST.
      await page.route('**/api/warehouse', async route => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({error: 'temporary outage'}),
          });
        } else await route.continue();
      }, {times: 1});
      await page.locator('[data-act="new"]').first().click();
      await page.locator('#bottling-form [name="name"]').fill(name);
      await page.locator('#bottling-form button[type="submit"]').click();
      await page.getByText(
        'Gespeichert, aber die Anzeige konnte nicht aktualisiert werden.',
        {exact: false}
      ).waitFor();
      assert.equal(
        await page.locator('#bottling-form').count(),
        0,
        'the committed form must be closed'
      );
      const collection = (await requestJson(base, '/api/collection')).data;
      assert.equal(collection.bottlings.filter(b => b.name === name).length, 1);
    });
  }
);

test(
  'browser: concurrent bottling submits and Enter repeat create only one record',
  async () => {
    await session(async ({page, open, base}) => {
      await open();
      let postCount = 0;
      await page.route('**/api/bottlings', async route => {
        if (route.request().method() !== 'POST') return route.continue();
        postCount++;
        await new Promise(resolve => setTimeout(resolve, 600));
        await route.continue();
      });
      await page.locator('[data-act="new"]').first().click();
      await page.locator('#bottling-form [name="name"]')
        .fill('N6 concurrent bottling');
      await page.evaluate(() => {
        const form = document.querySelector('#bottling-form');
        form.requestSubmit();
        form.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
      });
      assert.equal(
        await page.locator('#bottling-form').getAttribute('aria-busy'),
        'true'
      );
      assert.equal(
        await page.locator('#bottling-form button[type="submit"]').isDisabled(),
        true
      );
      await page.locator('#bottling-form').waitFor({state: 'detached'});
      assert.equal(postCount, 1);
      const collection = (await requestJson(base, '/api/collection')).data;
      assert.equal(
        collection.bottlings.filter(b => b.name ===
          'N6 concurrent bottling').length,
        1
      );
    });
  }
);

test(
  'browser: concurrent bottle submits create once; HTTP POST failure allows another attempt',
  async () => {
    await session(async ({page, open, base}) => {
      const {bottling} = await seed(base);
      await open({query: `?bottling=${bottling.id}`});
      await page.locator('[data-act="add-bottle"]').first().click();
      await page.locator('#bottle-form [name="inventoryNumber"]')
        .fill('009201');
      let postCount = 0;
      await page.route('**/api/bottles', async route => {
        if (route.request().method() !== 'POST') return route.continue();
        postCount++;
        if (postCount === 1) {
          await new Promise(resolve => setTimeout(resolve, 400));
          return route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({error: 'private diagnostic'}),
          });
        }
        await new Promise(resolve => setTimeout(resolve, 400));
        await route.continue();
      });
      await page.evaluate(() => {
        const form = document.querySelector('#bottle-form');
        form.requestSubmit();
        form.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
      });
      await page.waitForFunction(() =>
        document.querySelector('#bottle-form')?.getAttribute('aria-busy') === null);
      assert.equal(
        await page.locator('#bottle-form button[type="submit"]').isEnabled(),
        true
      );
      assert.equal(
        await page.locator('#bottle-form [name="inventoryNumber"]')
          .inputValue(),
        '009201'
      );
      assert.equal(postCount, 1);
      assert.equal(
        (await requestJson(base, '/api/collection')).data.bottlings[0]
          .bottles.length,
        1
      );
      await page.evaluate(() => {
        const form = document.querySelector('#bottle-form');
        form.requestSubmit();
        form.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
      });
      await page.locator('#bottle-form').waitFor({state: 'detached'});
      assert.equal(postCount, 2);
      const records = (await requestJson(base, '/api/collection')).data
        .bottlings[0].bottles;
      assert.equal(
        records.filter(b => b.inventoryNumber === '009201').length,
        1
      );
    });
  }
);

test(
  'browser: cards and table preference survive a full reload in both directions',
  async () => {
    if (domOnly) return; // F5 must reload the actual application, not the DOM-only harness.
    await session(async ({base, page, open}) => {
      await seed(base, '092310');
      await open();
      await page.locator('.whisky-card').waitFor();
      assert.equal(await page.locator('.collection-table-wrap').count(), 0);
      await page.locator('[data-act="toggle-view"]').click();
      await page.locator('.collection-table-wrap').waitFor();
      assert.equal(
        await page.evaluate(() =>
          localStorage.getItem('whisky-collection-view')),
        'table'
      );
      await page.reload();
      await page.locator('.collection-table-wrap').waitFor();
      assert.equal(
        await page.locator('.whisky-card').count(),
        0,
        'reload retains table view'
      );
      await page.locator('[data-act="toggle-view"]').click();
      await page.locator('.whisky-card').waitFor();
      assert.equal(
        await page.evaluate(() =>
          localStorage.getItem('whisky-collection-view')),
        'cards'
      );
      await page.reload();
      await page.locator('.whisky-card').waitFor();
      assert.equal(
        await page.locator('.collection-table-wrap').count(),
        0,
        'reload retains card view'
      );
    });
  }
);

test(
  'browser: collection table columns are configurable and header sorting updates the sort selector',
  async () => {
    await session(async ({base, page, open}) => {
      for (const [name, inventoryNumber] of [['Column Alpha', '092311'], ['Column Zulu', '092312']]) {
        const created = await requestJson(base, '/api/bottlings', 'POST', {
          name, firstBottle: {inventoryNumber, status: 'closed'},
        });
        assert.equal(created.status, 201);
      }
      await open();
      await page.locator('[data-act="toggle-view"]').click();
      assert.equal(
        await page.locator('thead [data-column="rating"]').count(),
        1
      );
      assert.equal(
        await page.locator('thead [data-column="editing"]').count(),
        0
      );
      // Playwright scrolls the document to bring the summary into view when
      // clicking it. Compare DOCUMENT coordinates, not viewport coordinates:
      // the latter change on scroll even when the overlay causes no reflow.
      const tableTopBefore = await page.locator('.collection-table-wrap')
        .evaluate(table =>
          table.getBoundingClientRect().top + window.scrollY);
      await page.locator('.collection-table-columns > summary').click();
      const columnMenuMetrics =
        await page.locator('.collection-table-columns-menu').evaluate(menu => {
          const choices =
            [...menu.querySelectorAll('.collection-table-column-choice')];
          const first = choices[0].getBoundingClientRect();
          const second = choices[1].getBoundingClientRect();
          const checkbox = choices[0].querySelector('input')
            .getBoundingClientRect();
          return {
            rowHeight: first.height, rowGap: second.top - first.bottom,
            checkboxWidth: checkbox.width, checkboxHeight: checkbox.height,
            accentColor: getComputedStyle(choices[0].querySelector('input'))
              .accentColor,
            menuPosition: getComputedStyle(menu).position,
          };
        });
      assert.equal(
        columnMenuMetrics.menuPosition,
        'absolute',
        'the columns picker floats over the table'
      );
      assert.equal(
        await page.locator('.collection-table-wrap').evaluate(table =>
          table.getBoundingClientRect().top + window.scrollY),
        tableTopBefore,
        'opening the picker does not push the table down'
      );
      assert.ok(
        columnMenuMetrics.rowHeight <= 38,
        'column options are compact rows'
      );
      assert.ok(
        columnMenuMetrics.rowGap <= 5,
        'column options have a small consistent gap'
      );
      assert.ok(
        columnMenuMetrics.checkboxWidth <= 18 &&
        columnMenuMetrics.checkboxHeight <= 18,
        'checkboxes are not enlarged by global input styles'
      );
      await page.locator('[data-collection-column="editing"]').focus();
      assert.equal(
        await page.locator('[data-collection-column="editing"]')
          .evaluate(input =>
            getComputedStyle(input).outlineStyle),
        'solid',
        'checkbox uses the app-standard keyboard focus'
      );
      assert.notEqual(
        columnMenuMetrics.accentColor,
        'auto',
        'checkbox uses the app accent color'
      );
      await page.locator('[data-collection-column="editing"]').check();
      assert.equal(
        await page.locator('thead [data-column="editing"]').count(),
        1
      );
      await page.locator('[data-collection-column="rating"]').uncheck();
      assert.equal(
        await page.locator('thead [data-column="rating"]').count(),
        0
      );
      // The picker remains open after a checkbox change, but floats above
      // the table without ever moving the table down.
      await page.locator('[data-collection-column="tasted"]').check();
      assert.equal(
        await page.locator('.collection-table-columns[open]').count(),
        1
      );
      const pickerOverlay =
        await page.locator('.collection-table-columns-menu').evaluate(menu => {
          const menuRect = menu.getBoundingClientRect();
          const triggerRect = menu.closest('details').querySelector('summary')
            .getBoundingClientRect();
          const tableRect = document.querySelector('.collection-table-wrap')
            .getBoundingClientRect();
          return {
            menuTop: menuRect.top,
            menuBottom: menuRect.bottom,
            tableTop: tableRect.top,
            tableDocumentTop: tableRect.top + window.scrollY,
            triggerBottom: triggerRect.bottom,
          };
        });
      assert.ok(pickerOverlay.menuTop >= pickerOverlay.triggerBottom,
        'column picker opens immediately below its trigger');
      assert.ok(pickerOverlay.menuBottom > pickerOverlay.tableTop,
        'column picker overlays the table rather than pushing it away');
      assert.equal(pickerOverlay.tableDocumentTop, tableTopBefore,
        'checkbox changes also preserve the table position');
      // Reproduce the reported bug: close the picker manually after adding
      // columns, then click the last visible header. It must stay CLOSED.
      await page.locator('.collection-table-columns > summary').click();
      assert.equal(
        await page.locator('.collection-table-columns[open]').count(),
        0
      );
      await page.locator('thead th:last-child .collection-table-sort').click();
      assert.equal(
        await page.locator('#filter-sort').inputValue(),
        'tastedDesc'
      );
      assert.equal(
        await page.locator('.collection-table-columns[open]').count(),
        0,
        'sorting the last header must not reopen the manually closed picker'
      );
      // Switching from last-tasted sorting to name starts with A-Z.
      // Only another click on the SAME header reverses the direction.
      await page.locator('thead [data-column="name"]').click();
      assert.equal(await page.locator('#filter-sort').inputValue(), 'name');
      assert.equal(
        await page.locator('thead th[aria-sort="ascending"] [data-column="name"]').count(),
        1
      );
      assert.match(
        await page.locator('tbody tr').first().innerText(),
        /Column Alpha/
      );
      await page.locator('thead [data-column="name"]').click();
      assert.equal(await page.locator('#filter-sort').inputValue(), 'nameDesc');
      assert.equal(
        await page.locator('thead th[aria-sort="descending"] [data-column="name"]').count(),
        1
      );
      assert.match(
        await page.locator('tbody tr').first().innerText(),
        /Column Zulu/
      );
      await page.locator('[data-collection-mode="bottles"]').click();
      assert.equal(
        await page.locator('thead [data-column="rating"]').count(),
        1,
        'bottle mode keeps its own default columns'
      );
      await page.locator('thead [data-column="inventory"]').click();
      assert.equal(
        await page.locator('#filter-sort').inputValue(),
        'inventoryAsc'
      );
      await page.locator('thead [data-column="inventory"]').click();
      assert.equal(
        await page.locator('#filter-sort').inputValue(),
        'inventoryDesc'
      );
      if (!domOnly) {
        // The URL retains ?mode=bottles across F5. Verify the current
        // bottle table first; only then switch back to bottlings to check
        // the independently stored bottling column selection.
        assert.match(new URL(page.url()).search, /mode=bottles/);
        await page.reload();
        await page.locator('.collection-table-wrap').waitFor();
        assert.equal(
          await page.locator('[data-collection-mode="bottles"]')
            .getAttribute('aria-pressed'),
          'true'
        );
        assert.equal(
          await page.locator('thead [data-column="inventory"]').count(),
          1,
          'the selected bottle columns survive a page reload'
        );
        assert.equal(
          await page.locator('thead [data-column="rating"]').count(),
          1,
          'bottle mode retains its separate rating column'
        );
        await page.locator('[data-collection-mode="bottlings"]').click();
        assert.equal(
          await page.locator('thead [data-column="editing"]').count(),
          1,
          'the selected bottling columns survive a page reload'
        );
        assert.equal(
          await page.locator('thead [data-column="rating"]').count(),
          0,
          'the hidden bottling rating remains hidden'
        );
      }
    });
  }
);
