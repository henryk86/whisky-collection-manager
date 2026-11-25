import test from 'node:test';
import assert from 'node:assert/strict';
import {session, seed} from './support.js';

const sizes = [390, 768, 1024, 1440];
const themes = ['light', 'dark'];

// Geometry is read from Chromium's layout boxes, not asserted from CSS text.
test(
  'browser: M4 detail panels and 2-/3-column fields keep their geometry in both themes',
  async () => {
    await session(async ({page, open, base}) => {
      const {bottling} = await seed(base, '008901');
      await open({query: `?bottling=${bottling.id}`});
      await page.locator('[data-region="detail-bottling"] [data-ds-detail-grid]').waitFor();
      for (const width of sizes) {
        await page.setViewportSize({width, height: 900});
        for (const theme of themes) {
          await page.evaluate(
            theme => {document.documentElement.dataset.theme = theme;},
            theme
          );
          const geometry = await page.evaluate(() => {
            const panel = document.querySelector('[data-region="detail-bottling"] [data-ds-panel="standard"]');
            const grid = panel.querySelector('[data-ds-detail-grid="2"]');
            const field = grid.querySelector('[data-ds-detail-field="fact"]');
            const r = panel.getBoundingClientRect();
            return {
              width: r.width,
              left: r.left,
              padding: getComputedStyle(panel).paddingLeft,
              cols: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
              fieldWidth: field.getBoundingClientRect().width,
              overflow: document.documentElement.scrollWidth - innerWidth,
              panelCount: panel.querySelectorAll('.panel').length,
            };
          });
          assert.ok(geometry.width > 0 && geometry.fieldWidth > 0, `${width}/${theme}: visible panel and fields`);
          assert.equal(geometry.panelCount, 0, 'no nested panel border');
          assert.ok(geometry.overflow <= 1, `${width}/${theme}: no horizontal overflow`);
          assert.ok(geometry.cols >= 1 && geometry.cols <= 2, `${width}/${theme}: 1–2 columns, never cramped 3`);
          assert.ok(parseFloat(geometry.padding) > 0);
        }
      }
    });
  }
);

test(
  'browser: M4 empty collection is a standalone onboarding state',
  async () => {
    await session(async ({page, open}) => {
      await open();
      await page.locator('[data-ds-empty-state="collection"]').waitFor();
      assert.equal(await page.locator('[data-ds-empty-state="collection"] .panel').count(), 0);
      const boxes = await page.locator('[data-ds-empty-state="collection"]').evaluate(el => ({
        border: getComputedStyle(el).borderTopStyle,
        overflow: document.documentElement.scrollWidth - innerWidth,
      }));
      assert.equal(boxes.border, 'dashed');
      assert.ok(boxes.overflow <= 1);
    });
  }
);

test(
  'browser: M4 missing attachments render quietly inside an existing bottle',
  async () => {
    await session(async ({page, open, base}) => {
      const {bottling} = await seed(base, '008902');
      await open({query: `?bottling=${bottling.id}`});
      const hint = page.locator('.bottle-documents [data-ds-empty-state="subtle"]');
      await hint.waitFor({state: 'visible'});
      assert.equal(await hint.evaluate(el => getComputedStyle(el).borderTopWidth), '0px');
      assert.ok((await hint.innerText()).trim().length > 0);
    });
  }
);

test(
  'browser: M4 saved tasting notes use the common detail fields without losing text',
  async () => {
    await session(async ({page, open, base}) => {
      const {bottling} = await seed(base, '008903');
      const response = await fetch(
        base + `/api/bottlings/${bottling.id}/tastings`,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            tastedOn: '2026-11-20',
            rating: 85,
            tastingNotes: {
              nose: 'Frucht & Vanille',
              palate: 'Malz',
              finish: 'Langer Abgang',
            },
          }),
        }
      );
      assert.equal(response.status, 201);
      await open({query: `?bottling=${bottling.id}`});
      const opener = page.locator('.tasting-summary-card [data-act="tastings-open"]');
      await opener.click();
      const notes = page.locator('.tasting-readonly-notes [data-ds-detail-field="note"]');
      await notes.first().waitFor();
      assert.equal(await notes.count(), 3);
      assert.match(await notes.first().innerText(), /Frucht & Vanille/);
      for (const width of [390, 1440]) {
        await page.setViewportSize({width, height: 900});
        const bounds = await notes.first().evaluate(el => ({
          width: el.getBoundingClientRect().width,
          overflow: document.documentElement.scrollWidth - innerWidth,
        }));
        assert.ok(bounds.width > 0 && bounds.overflow <= 1);
      }
    });
  }
);
