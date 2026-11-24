import test from 'node:test';
import assert from 'node:assert/strict';
import {session, openSettingsFromMenu, openSettingsSection, seed} from './support.js';
import {requestJson} from '../helpers/server.js';

test(
  'browser: collection search, pagination and view change retain the mounted controls',
  async () => {
    await session(async ({page, open, base}) => {
      await seed(base, '008101');
      await open();
      await page.locator('#search').evaluate(node => {
        window.__searchNode =
          node;
      });
      await page.locator('#search').fill('Browser Test');
      assert.equal(await page.locator('.collection-heading').count(), 1);
      assert.equal(
        await page.locator('#search').evaluate(node => node ===
          window.__searchNode),
        true
      );
      await page.locator('[data-collection-mode="bottles"]').click();
      assert.equal(
        await page.locator('#search').evaluate(node => node ===
          window.__searchNode),
        true
      );
      await page.locator('[data-collection-mode="bottlings"]').click();
      await page.locator('#filter-status').selectOption('closed');
      assert.equal(await page.locator('#filter-status').inputValue(), 'closed');
      assert.equal(
        await page.locator('#search').evaluate(node => node ===
          window.__searchNode),
        true
      );
    });
  }
);

test(
  'browser: collection settings save applies server delta without extra collection GET',
  async () => {
    await session(async ({page, open, base}) => {
      await open();
      await openSettingsFromMenu(page);
      await openSettingsSection(page, 'general');
      const requests = [];
      page.on(
        'request',
        req => {
          if (req.url()
            .endsWith('/api/collection')) requests.push(req.method());
        }
      );
      await page.locator('#established-year').fill('2015');
      await page.locator('#collection-settings-form button[type="submit"]')
        .click();
      await page.locator('.toast:not(.error)').waitFor();
      assert.equal(
        await page.locator('#established-year').inputValue(),
        '2015'
      );
      assert.deepEqual(
        requests,
        [],
        'successful mutation should not GET the full collection'
      );
      const saved = (await requestJson(base, '/api/collection')).data;
      assert.equal(saved.settings.establishedYear, 2015);
    });
  }
);

test(
  'browser: mutation after an out-of-band write falls back to full GET',
  async () => {
    await session(async ({page, open, base}) => {
      await open();
      await openSettingsFromMenu(page);
      await openSettingsSection(page, 'general');
      const prior = await requestJson(base, '/api/settings', 'PATCH', {establishedYear: 2010});
      assert.equal(prior.status, 200);
      const requests = [];
      page.on(
        'request',
        req => {
          if (req.url()
            .endsWith('/api/collection')) requests.push(req.method());
        }
      );
      await page.locator('#established-year').fill('2016');
      await page.locator('#collection-settings-form button[type="submit"]')
        .click();
      await page.locator('.toast:not(.error)').waitFor();
      assert.deepEqual(
        requests,
        ['GET'],
        'stale baseline must trigger a full revalidation'
      );
      assert.equal(
        (await requestJson(base, '/api/collection')).data.settings
          .establishedYear,
        2016
      );
    });
  }
);

test(
  'browser: map sidebar controls remain functional with delegated listeners',
  async () => {
    await session(async ({page, open}) => {
      await open();
      await page.locator('header [data-act="toggle-menu"]').click();
      await page.locator('#site-drawer [data-act="goto-map"]').click();
      await page.locator('#map-all-distilleries').check();
      assert.equal(
        await page.locator('#map-all-distilleries').isChecked(),
        true
      );
      await page.locator('#map-site-select').waitFor();
      const count = await page.locator('#map-site-select option').count();
      assert.ok(count > 0);
      await page.locator('#map-site-select').selectOption({index: 0});
      assert.equal(
        await page.locator('#map-all-distilleries').isChecked(),
        true
      );
    });
  }
);

test(
  'browser: analytics workspace and footer use actual computed layout at desktop and mobile sizes',
  async () => {
    await session(async ({page, open}) => {
      await open();
      await page.locator('header [data-act="toggle-menu"]').click();
      await page.locator('#site-drawer [data-act="goto-analysis"]').click();
      for (const width of [1366, 390]) {
        await page.setViewportSize({width, height: 900});
        const metrics = await page.locator('.analytics-page').evaluate(page => {
          const wrapper = getComputedStyle(page);
          const main = document.querySelector('main');
          const mainRect = main.getBoundingClientRect();
          const pageRect = page.getBoundingClientRect();
          return {
            mainWidth: mainRect.width - parseFloat(getComputedStyle(main)
              .paddingLeft) - parseFloat(getComputedStyle(main).paddingRight),
            pageWidth: pageRect.width,
            paddingTop: wrapper.paddingTop,
            padBottom: wrapper.paddingBottom,
            footnote: document.querySelector('.analytics-footnote') ?
              getComputedStyle(document.querySelector('.analytics-footnote'))
                .marginBottom : null,
            scroller: document.documentElement.scrollWidth,
            viewport: document.documentElement.clientWidth,
          };
        });
        assert.ok(
          Math.abs(metrics.mainWidth - metrics.pageWidth) < 2,
          `analytics must fill main at width ${width}`
        );
        assert.equal(metrics.paddingTop, '0px');
        assert.equal(metrics.padBottom, '10px');
        if (metrics.footnote !== null) assert.equal(metrics.footnote, '0px');
        assert.ok(
          metrics.scroller <= metrics.viewport + 1,
          `no horizontal page overflow at ${width}`
        );
      }
    });
  }
);

test(
  'browser: section navigation retains its gold active marker with real CSS',
  async () => {
    await session(async ({page, open}) => {
      await open();
      await page.locator('header [data-act="toggle-menu"]').click();
      await page.locator('#site-drawer [data-act="goto-analysis"]').click();
      const marker = await page.locator('.section-nav-item.active')
        .evaluate(node => ({
          radius: getComputedStyle(node).borderRadius,
          width: getComputedStyle(node).borderLeftWidth,
          color: getComputedStyle(node).borderLeftColor,
        }));
      assert.equal(marker.radius, '0px');
      assert.equal(marker.width, '3px');
      assert.equal(marker.color, 'rgb(189, 152, 98)');
    });
  }
);
