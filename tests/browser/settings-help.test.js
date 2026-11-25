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
  'browser: help page is available from the menu and on direct navigation',
  async () => {
    await session(async ({page, open}) => {
      await open();
      await page.locator('header [data-act="toggle-menu"]').click();
      await page.locator('#site-drawer [data-act="goto-help"]').click();
      await page.locator('.help-page').waitFor();
      assert.equal(
        await page.locator('.section-nav-item[data-help-topic]').count(),
        HELP_TOPICS.length
      );
      assert.equal(await page.locator('.section-nav-mobile select').count(), 1);
      assert.equal(
        await page.locator('.help-section:not([hidden])').count(),
        1
      );
      await page.locator('[data-help-topic="storage"]').click();
      assert.equal(
        await page.locator('.help-section:not([hidden])').count(),
        1
      );
      assert.match(
        await page.locator('#help-panel-storage').innerText(),
        /Regale|Fächer/
      );
      await page.locator('[data-help-topic="data"]').click();
      assert.match(
        await page.locator('#help-panel-data').innerText(),
        /data\/warehouse\.json/
      );
      assert.equal(
        await page.locator('#site-drawer [aria-current="page"]')
          .getAttribute('data-act'),
        'goto-help'
      );
    });
  }
);





test(
  'browser: help articles use the approved right-hand analysis-style panel',
  async () => {
    await session(async ({page, open}) => {
      await open();
      await page.locator('header [data-act="toggle-menu"]').click();
      await page.locator('#site-drawer [data-act="goto-help"]').click();
      for (const width of [1440, 390]) {
        await page.setViewportSize({width, height: 900});
        const layout = await page.locator(
          '#help-panel-basics .help-content-panel').evaluate(panel => {
            const section = panel.closest('.help-section');
            const title = section.querySelector(
              ':scope > .analytics-section-title');
            const panelRect = panel.getBoundingClientRect();
            const titleRect = title.getBoundingClientRect();
            const style = getComputedStyle(panel);
            return {
              corner: style.borderRadius,
              border: style.borderTopWidth,
              background: style.backgroundColor,
              titleAbove: titleRect.bottom < panelRect.top,
              overflows: document.documentElement.scrollWidth >
                window.innerWidth + 1,
              leftNav: getComputedStyle(document.querySelector(
                '.section-nav-desktop')).display,
            };
          });
        assert.equal(layout.corner, '0px');
        assert.equal(layout.border, '1px');
        assert.notEqual(layout.background, 'rgba(0, 0, 0, 0)');
        assert.equal(
          layout.titleAbove,
          true,
          'help heading must remain outside the panel'
        );
        assert.equal(
          layout.overflows,
          false,
          `${width}px: help panel must not overflow`
        );
        assert.equal(layout.leftNav === 'none', width === 390,
          `${width}px: only mobile uses the help section selector`);
      }
      await page.setViewportSize({width: 1440, height: 900});
      await page.locator('.section-nav-item[data-help-topic="storage"]')
        .click();
      assert.equal(
        await page.locator(
          '#help-panel-storage:not([hidden]) .help-content-panel').count(),
        1
      );
      assert.equal(
        await page.locator('#help-panel-basics:not([hidden])').count(),
        0
      );
    });
  }
);




test(
  'browser: straight active navigation line and shared responsive \
analysis/help workspace',
  async () => {
    await session(async ({page, open}) => {
      await open();
      await page.locator('header [data-act="toggle-menu"]').click();
      await page.locator('#site-drawer [data-act="goto-analysis"]').click();
      const sidebar = page.locator('.section-nav-desktop');
      assert.equal(await sidebar.isVisible(), true);
      const marker = await page.locator('.section-nav-item.active')
        .evaluate(item => {
          const css = getComputedStyle(item);
          return {
            width: css.borderLeftWidth,
            radius: css.borderRadius,
            color: css.borderLeftColor,
            gold: getComputedStyle(document.documentElement)
              .getPropertyValue('--gold').trim(),
          };
        });
      assert.equal(marker.width, '3px');
      assert.equal(marker.radius, '0px');
      assert.equal(marker.color, 'rgb(189, 152, 98)');
      await page.locator('.section-nav-item[data-section="quality"]').click();
      assert.equal(
        await page.locator('.section-nav-item.active')
          .getAttribute('data-section'),
        'quality'
      );
      assert.equal(
        await page.locator('.section-nav-item.active')
          .getAttribute('aria-current'),
        'page'
      );
      await page.setViewportSize({width: 390, height: 844});
      assert.equal(await sidebar.isVisible(), false);
      assert.equal(
        await page.locator('[data-section-switch="analytics"]').isVisible(),
        true
      );
      await page.locator('[data-section-switch="analytics"]')
        .selectOption('overview');
      assert.equal(
        await page.locator('.analytics-section-title').innerText(),
        'Übersicht'
      );
      assert.equal(
        await page.evaluate(() => document.body.scrollWidth <=
          document.documentElement.clientWidth + 1),
        true
      );
      await page.locator('header [data-act="toggle-menu"]').click();
      await page.locator('#site-drawer [data-act="goto-help"]').click();
      assert.equal(
        await page.locator('.section-nav-desktop').isVisible(),
        false
      );
      await page.locator('[data-section-switch="help"]').selectOption('photos');
      assert.equal(await page.locator('#help-panel-photos').isVisible(), true);
      assert.equal(
        await page.locator('.help-section:not([hidden])').count(),
        1
      );
      assert.equal(
        await page.evaluate(() => document.body.scrollWidth <=
          document.documentElement.clientWidth + 1),
        true
      );
    });
  }
);



test(
  'browser: consistent section layout, readable help text and intentional \
filter rows at three widths',
  async () => {
    await session(async ({page, open}) => {
      await open();
      for (const width of [390, 1040, 1440]) {
        await page.setViewportSize({width, height: 900});
        const home = await page.evaluate(() => {
          const hero = document.querySelector('.hero-description');
          const range = document.createRange();
          range.selectNodeContents(hero);
          const lines = [...range.getClientRects()];
          /**
           * Locates the DOM elements used by top.
           *
           * @param {function(...*): *} selector Selector input for this
           * operation.
           * @return {number} Calculated numeric value.
           */
          const top = selector => Math.round(document.querySelector(selector)
            .getBoundingClientRect().top);
          return {
            text: hero.textContent, lines: lines.length,
            right: Math.max(...lines.map(rect => rect.right)),
            heroRight: document.querySelector('.collection-hero')
              .getBoundingClientRect().right,
            tops: {
              search: top('#search'),
              sort: top('#filter-sort'),
              status: top('#filter-status'),
              completion: top('#filter-completion'),
              toggle: top('.collection-filter-toggle'),
              view: top('.collection-filter-view'),
            }, scroll: document.documentElement.scrollWidth,
          };
        });
        assert.equal(
          home.text,
          'Von der besonderen Abfüllung bis zum letzten Dram. Entdecke, \
erfasse und verwalte deine Whisky-Sammlung.'
        );
        assert.ok(
          home.scroll <= width,
          `${width}px: collection must not overflow`
        );
        if (width > 740) {
          assert.equal(
            home.lines,
            1,
            `${width}px: BOTH hero sentences must share ONE line`
          );
          assert.ok(
            home.right <= home.heroRight + 1,
            `${width}px: complete text must remain inside banner`
          );
        }
        if (width === 1040) {
          assert.equal(
            home.tops.search,
            home.tops.sort,
            'tablet: search and sort share the first row'
          );
          assert.equal(home.tops.status, home.tops.completion);
          assert.equal(home.tops.completion, home.tops.toggle);
          assert.equal(home.tops.toggle, home.tops.view);
          assert.ok(
            home.tops.search < home.tops.status,
            'tablet: two compact control rows'
          );
        }
        await page.locator('[data-act="toggle-menu"]').click();
        await page.locator('[data-act="goto-help"]').click();
        await page.locator('.help-steps').first().waitFor();
        assert.equal(
          await page.locator('.help-section:not([hidden]) .help-steps > li')
            .count(),
          4
        );
        const help = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          sidebarVisible: getComputedStyle(document.querySelector(
            '.section-nav-desktop')).display !== 'none',
          itemHeights: [...document.querySelectorAll('.section-nav-item')]
            .map(item => item.getBoundingClientRect().height),
        }));
        assert.ok(help.scroll <= width, `${width}px: help must not overflow`);
        if (width >= 1040) assert.ok(
          help.itemHeights.every(height => height <= 45),
          `${width}px: help topic names must not wrap (heights: ${help
            .itemHeights.join(', ')})`
        );
        else assert.equal(
          help.sidebarVisible,
          false,
          'mobile: use the topic selector'
        );
        await page.locator('[data-act="toggle-menu"]').click();
        await page.locator('#site-drawer [data-act="goto-home"]').click();
        await page.locator('.collection-filters').waitFor();
      }
      await page.setViewportSize({width: 1040, height: 900});
      await page.locator('[data-act="toggle-menu"]').click();
      await page.locator('[data-act="goto-analysis"]').click();
      await page.locator('.analytics-filters').waitFor();
      const filterTops = await page.locator('.analytics-filters > *')
        .evaluateAll(nodes =>
          nodes.map(node => Math.round(node.getBoundingClientRect().top)));
      assert.ok(filterTops.every(top => top === filterTops[0]),
        'analytics: reset button must not be stranded on a separate row on \
tablets');
    });
  }
);




test(
  'browser: settings and warehouse share section navigation with mobile \
selector and preserve unsaved settings',
  async () => {
    await session(async ({page, open}) => {
      await open();
      await openSettingsFromMenu(page);
      assert.equal(
        await page.locator('.settings-page .section-nav-item').count(),
        4
      );
      await page.locator('#established-year').fill('1998');
      await page.locator('.settings-page [data-settings-section="transfer"]')
        .click();
      assert.equal(
        await page.locator('[data-settings-panel="general"]').isVisible(),
        false
      );
      assert.equal(
        await page.locator('[data-settings-panel="transfer"]').isVisible(),
        true
      );
      await page.locator('.settings-page [data-settings-section="general"]')
        .click();
      assert.equal(
        await page.locator('#established-year').inputValue(),
        '1998',
        'unsaved year is preserved'
      );
      await page.setViewportSize({width: 390, height: 844});
      await page.locator('[data-section-switch="settings"]')
        .selectOption('backups');
      assert.equal(
        await page.locator('[data-settings-panel="backups"]').isVisible(),
        true
      );
      await page.locator('[data-section-switch="settings"]')
        .selectOption('distilleries');
      assert.equal(
        await page.locator('[data-settings-panel="distilleries"]').isVisible(),
        true
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <=
          innerWidth + 1),
        true
      );
      await page.locator('header [data-act="toggle-menu"]').click();
      await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
      await page.locator('.warehouse-page').waitFor();
      assert.equal(
        await page.locator('.warehouse-tabs .section-nav-item').count(),
        4
      );
      assert.equal(await page.locator('.warehouse-tabs').isVisible(), false);
      await page.locator('[data-section-switch="warehouse"]')
        .selectOption('find');
      assert.equal(
        await page.locator(
          '.section-workspace-content > .analytics-section-title').innerText(),
        'Flaschen finden'
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <=
          innerWidth + 1),
        true
      );
    });
  }
);



test(
  'browser: distilleries settings use a flat single-heading section without \
nested scrolling',
  async () => {
    await session(async ({page, open}) => {
      await open();
      await openSettingsFromMenu(page);
      await page.locator('[data-settings-section="distilleries"]').click();
      const section = page.locator('[data-settings-panel="distilleries"]');
      assert.equal(await section.isVisible(), true);
      assert.equal(await section.locator('h2').count(), 1);
      assert.equal(await section.locator('h3').count(), 0);
      const metrics = await section.evaluate(el => {
        const list = el.querySelector('.distillery-list');
        const panel = el.querySelector('.panel.section');
        return {
          overflow: getComputedStyle(list).overflowY,
          listHeight: list.getBoundingClientRect().height,
          panelBackground: getComputedStyle(panel).backgroundColor,
          panelBorder: getComputedStyle(panel).borderTopWidth,
          rows: list.querySelectorAll('.distillery-row').length,
        };
      });
      assert.equal(metrics.overflow, 'visible');
      assert.ok(metrics.rows > 100, 'full distillery catalog must render');
      assert.ok(
        metrics.listHeight > 1000,
        'list uses document height, not a fixed viewport-sized scrollbox'
      );
      assert.notEqual(metrics.panelBackground, 'rgba(0, 0, 0, 0)');
      assert.equal(metrics.panelBorder, '1px');
      // Settings inherit the same straight-edged content-surface language
      // as the analytics panels, not the older rounded dashboard cards.
      assert.equal(
        await section.locator('.panel.section').evaluate(el =>
          getComputedStyle(el).borderTopLeftRadius),
        '0px'
      );
      await page.locator('[data-settings-section="general"]').click();
      assert.equal(
        await page.locator('.settings-section:not([hidden]) .panel.section')
          .first().evaluate(el => getComputedStyle(el).borderTopLeftRadius),
        '0px'
      );
    });
  }
);



test(
  'browser: home hero shows the entire original description on one line at \
desktop widths',
  async () => {
    await session(async ({page, open}) => {
      await open();
      for (const width of [768, 900, 1040, 1440, 1920]) {
        await page.setViewportSize({width, height: 920});
        const result = await page.evaluate(() => {
          const hero = document.querySelector('.collection-hero');
          const copy = hero.querySelector('.hero-description');
          const range = document.createRange();
          range.selectNodeContents(copy);
          const rects = [...range.getClientRects()];
          return {
            text: copy.textContent, lines: rects.length,
            right: Math.max(...rects.map(rect => rect.right)),
            heroRight: hero.getBoundingClientRect().right,
            documentWidth: document.documentElement.scrollWidth,
          };
        });
        assert.equal(result.text,
          'Von der besonderen Abfüllung bis zum letzten Dram. Entdecke, \
erfasse und verwalte deine Whisky-Sammlung.');
        assert.equal(
          result.lines,
          1,
          `${width}px: the COMPLETE text must be on one line`
        );
        assert.ok(
          result.right <= result.heroRight + 1,
          `${width}px: text must fit hero`
        );
        assert.ok(
          result.documentWidth <= width,
          `${width}px: no horizontal overflow`
        );
      }
    });
  }
);



test(
  'browser: unassigned staging search shares the pagination footer and \
retains focus while filtering',
  async () => {
    await session(async ({base, page, open}) => {
      const room = (await requestJson(base, '/api/warehouse/rooms', 'POST',
        {name: 'Layout-Testzimmer', width: 4, height: 4})).data;
      const furniture = (await requestJson(
        base,
        `/api/warehouse/rooms/${room.id}/furniture`,
        'POST',
        {
          name: 'Regal',
          type: 'regal',
          x: 0.2,
          y: 0.2,
          width: 1,
          depth: 0.4,
          rotation: 0,
          elevation: 0,
          itemHeight: 1.8,
        }
      )).data;
      assert.equal(
        (await requestJson(
          base,
          `/api/warehouse/furniture/${furniture.id}/shelves`,
          'POST',
          {name: 'Fach', capacity: 12}
        )).status,
        201
      );
      await seed(base, '731001');
      await seed(base, '731002');
      await open();
      await page.setViewportSize({width: 1680, height: 900});
      await page.locator('header [data-act="toggle-menu"]').click();
      await page.locator('#site-drawer [data-act="goto-warehouse"]').click();
      await page.locator('[data-section="rooms"]').click();
      await page.locator('#warehouse-room-select').selectOption(room.id);
      assert.equal(
        await page.locator('.warehouse-room-summary').evaluate(el =>
          getComputedStyle(el).borderTopLeftRadius),
        '0px'
      );
      await page.locator('[data-section="shelves"]').click();
      await page.locator('.warehouse-unassigned-toggle').click();
      const footer = await page.locator('.warehouse-unassigned-pagination')
        .evaluate(el => {
          /**
           * Locates the DOM elements used by rect.
           *
           * @param {function(...*): *} selector Selector input for this
           * operation.
           * @return {*} Matching DOM element, if present.
           */
          const rect = selector => el.querySelector(selector)
            .getBoundingClientRect();
          const summary = rect('.warehouse-unassigned-page-summary');
          const input = rect('#warehouse-unassigned-wall-search');
          const pager = rect('.warehouse-unassigned-page-controls');
          return {
            left: [summary.left, input.left, pager.left],
            right: [summary.right, input.right, pager.right],
            top: [summary.top, input.top, pager.top],
          };
        });
      assert.ok(
        footer.right[0] < footer.left[1] && footer.right[1] < footer.left[2],
        `footer order is count – search – previous page: ${JSON.stringify(
          footer)}`
      );
      assert.ok(
        Math.max(...footer.top) - Math.min(...footer.top) < 16,
        'footer elements belong in the same row'
      );
      await page.locator('.warehouse-unassigned-pagination')
        .screenshot({
          path:
            'test-artifacts/warehouse-unassigned-footer-0233.png',
        });
      const input = page.locator('#warehouse-unassigned-wall-search');
      await input.fill('731001');
      assert.equal(
        await page.evaluate(() => document.activeElement?.id),
        'warehouse-unassigned-wall-search'
      );
      assert.equal(
        await page.locator('.warehouse-unassigned-bottle').count(),
        1
      );
      await input.fill('731002');
      assert.equal(
        await page.evaluate(() => document.activeElement?.id),
        'warehouse-unassigned-wall-search'
      );
      assert.equal(
        await page.locator('.warehouse-unassigned-bottle').count(),
        1
      );
      await input.fill('');
      assert.equal(
        await page.locator('.warehouse-unassigned-bottle').count(),
        2
      );
      assert.equal(
        await page.locator('.warehouse-unassigned-page-search').count(),
        1
      );
      await page.setViewportSize({width: 390, height: 844});
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <=
          innerWidth + 1),
        true,
        'the footer search and pager must not cause horizontal overflow on \
phones'
      );
    });
  }
);



test(
  'browser: settings General heading uses the same panel gap as other \
settings sections',
  async () => {
    await session(async ({page, open}) => {
      await open();
      await openSettingsFromMenu(page);
      const gap = await page.locator('[data-settings-panel="general"]')
        .evaluate(el => {
          const title = el.querySelector(':scope > .analytics-section-title')
            .getBoundingClientRect();
          const panel = el.querySelector(':scope > .panel.section')
            .getBoundingClientRect();
          return panel.top - title.bottom;
        });
      assert.ok(
        Math.abs(gap - 16) < 0.75,
        `General heading and first panel should have the same 16px spacing \
as other settings groups, got ${gap}px`
      );
    });
  }
);

test(
  'browser: saving settings retains the form node and does not reload \
unchanged warehouse data',
  async () => {
    await session(async ({page, open, base}) => {
      await open();
      await openSettingsFromMenu(page);
      const field = page.locator('#established-year');
      await field.fill('2019');
      await field.evaluate(node => {window.__settingsFieldBeforeSave = node;});
      const warehouseGets = [];
      page.on('request', request => {
        if (request.method() === 'GET' && new URL(request.url()).pathname ===
          '/api/warehouse') {
          warehouseGets.push(request.url());
        }
      });
      await page.locator('#collection-settings-form button[type="submit"]')
        .click();
      // The success toast is emitted only after the mutation and full scoped
      // render have both finished, unlike checking persistence alone.
      await page.locator('.toast:not(.error)').waitFor({state: 'visible'});
      await page.waitForFunction(async () => {
        const res = await fetch('/api/collection');
        return res.ok && (await res.json()).settings?.establishedYear === 2019;
      });
      assert.equal(
        await field.evaluate(node => node === window.__settingsFieldBeforeSave),
        true,
        'a setting refresh must not destroy the form element'
      );
      assert.equal(await field.inputValue(), '2019');
      assert.deepEqual(
        warehouseGets,
        [],
        'collection-only settings update must not request the warehouse'
      );
    });
  }
);
