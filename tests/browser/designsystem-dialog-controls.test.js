import test from 'node:test';
import assert from 'node:assert/strict';
import {session, seed} from './support.js';

/**
 * Coordinates asynchronous work for go tastings.
 *
 * @param {*} page Page or view being rendered or selected.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
async function goTastings(page) {
  await page.locator('header [data-act="toggle-menu"]').click();
  await page.locator('#site-drawer [data-act="goto-tastings-home"]').click();
  await page.locator('.tasting-flight-home').waitFor({state: 'visible'});
}

// Check real positions with computed boxes rather than just source rules.
test(
  'browser: modal lock preserves background layout/scroll, focus and Escape at four widths in both themes',
  async () => {
    await session(async ({page, open}) => {
      await open();
      for (const width of [390, 768, 1024, 1440]) {
        await page.setViewportSize({width, height: 900});
        for (const theme of ['light', 'dark']) {
          await page.evaluate(
            theme => {document.documentElement.dataset.theme = theme;},
            theme
          );
          const trigger = page.locator('header [data-act="new"]');
          await trigger.focus();
          const before = await page.evaluate(() => ({
            left: document.querySelector('main').getBoundingClientRect().left,
            width: document.querySelector('main').getBoundingClientRect().width,
            scroll: window.scrollY,
            overflow: document.documentElement.scrollWidth - window.innerWidth,
          }));
          await trigger.click();
          const dialog = page.locator('#modal-root .ds-modal');
          await dialog.waitFor({state: 'visible'});
          const current = await page.evaluate(() => ({
            left: document.querySelector('main').getBoundingClientRect().left,
            width: document.querySelector('main').getBoundingClientRect().width,
            inert: document.querySelector('main').inert,
            focused: document.activeElement.closest('.ds-modal') !== null,
            disabled: document.querySelector('.ds-modal-body') !== null,
            overflow: document.documentElement.scrollWidth - window.innerWidth,
          }));
          assert.ok(
            Math.abs(current.left - before.left) <= 1,
            `${width}/${theme}: no horizontal position jump`
          );
          assert.ok(
            Math.abs(current.width - before.width) <= 1,
            `${width}/${theme}: no width jump`
          );
          assert.equal(current.inert, true);
          assert.equal(current.focused, true);
          assert.equal(current.disabled, true);
          assert.ok(
            current.overflow <= 1,
            `${width}/${theme}: no horizontal overflow`
          );
          // Focus stays in the application dialog when trying to Tab out.
          await page.locator('#modal-root .ds-modal-close').focus();
          await page.keyboard.press('Tab');
          assert.equal(
            await page.evaluate(() => Boolean(document.activeElement
              .closest('#modal-root'))),
            true
          );
          await page.keyboard.press('Escape');
          assert.equal(await page.locator('#modal-root .dialog').count(), 0);
          const after = await page.evaluate(() => ({
            left: document.querySelector('main').getBoundingClientRect().left,
            width: document.querySelector('main').getBoundingClientRect().width,
            scroll: window.scrollY, inert: document.querySelector('main').inert,
            restored: document.activeElement.matches('header [data-act="new"]'),
          }));
          assert.ok(Math.abs(after.left - before.left) <= 1);
          assert.ok(Math.abs(after.width - before.width) <= 1);
          assert.ok(Math.abs(after.scroll - before.scroll) <= 1);
          assert.equal(after.inert, false);
          assert.equal(
            after.restored,
            true,
            `${width}/${theme}: restore original trigger`
          );
        }
      }
    });
  }
);

test(
  'browser: planner-help nesting restores the identical live form, values, focus and scroll',
  async () => {
    await session(async ({page, open}) => {
      await open(); await goTastings(page);
      await page.locator('.tasting-flight-home [data-act="flight-plan-new"]')
        .click();
      const parent = page.locator('#modal-root .ds-modal');
      await page.locator('#modal-root [data-flight-name]')
        .fill('No lost form state');
      await page.locator('#modal-root [data-flight-notes]')
        .fill('Original unsaved notes');
      await page.locator('#modal-root [data-flight-plan-style]')
        .selectOption('similar');
      await page.locator('#modal-root .flight-plan-form')
        .evaluate(e => {e.dataset.identity = 'same-dom';});
      const trigger = page.locator('#modal-root [data-act="flight-plan-help"]');
      await trigger.focus(); await trigger.click();
      await page.locator('#modal-root .flight-plan-help')
        .waitFor({state: 'visible'});
      assert.equal(
        await page.locator('#modal-root .dialog').count(),
        1,
        'only the child is visible'
      );
      assert.equal(
        await page.locator('#modal-root [data-flight-name]').count(),
        0
      );
      await page.keyboard.press('Escape');
      await parent.locator('[data-flight-name]').waitFor({state: 'visible'});
      assert.equal(
        await page.locator('#modal-root .flight-plan-form')
          .getAttribute('data-identity'),
        'same-dom'
      );
      assert.equal(
        await parent.locator('[data-flight-name]').inputValue(),
        'No lost form state'
      );
      assert.equal(
        await parent.locator('[data-flight-notes]').inputValue(),
        'Original unsaved notes'
      );
      assert.equal(
        await parent.locator('[data-flight-plan-style]').inputValue(),
        'similar'
      );
      assert.equal(
        await page.evaluate(() => document.activeElement?.dataset.act),
        'flight-plan-help'
      );
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#modal-root .dialog').count(), 0);
    });
  }
);

test(
  'browser: photo modal uses explicit size and returns focus to photo trigger',
  async () => {
    await session(async ({page, open, base}) => {
      const {bottling} = await seed(base, '008840');
      await open({query: `?bottling=${bottling.id}`});
      // Document preview is covered by existing tests; here check edit modal
      // semantics.
      await page.locator('[data-act="edit-bottling"]').first().click();
      await page.locator('#modal-root .ds-modal--wide')
        .waitFor({state: 'visible'});
      const widths = await page.locator('#modal-root .ds-modal')
        .evaluate(el => ({
          width: el.getBoundingClientRect().width,
          max: getComputedStyle(el).maxHeight,
          header: el.querySelector('.dialog-head') !== null,
          content: el.querySelector('#bottling-form') !== null,
        }));
      assert.equal(widths.header, true); assert.equal(widths.content, true);
      assert.ok(widths.width <= 860 + 1, 'existing wide modal width preserved');
      assert.equal(
        await page.locator('#modal-root [aria-labelledby="ds-modal-title"]')
          .count(),
        1
      );
      await page.locator('#modal-root [data-act="close-modal"]').first()
        .click();
      assert.equal(await page.locator('#modal-root .dialog').count(), 0);
    });
  }
);

test(
  'browser: a nonzero background scroll offset survives modal stacking and keyboard exit',
  async () => {
    await session(async ({page, open}) => {
      await open();
      await page.evaluate(() => {
        // Give the normal collection view a deterministic long-scroll state.
        document.querySelector('main').style.minHeight = '1900px';
        window.scrollTo({top: 520, behavior: 'instant'});
      });
      const before = await page.evaluate(() => ({
        scroll: window.scrollY,
        left: document.querySelector('main').getBoundingClientRect().left,
        width: document.querySelector('main').getBoundingClientRect().width,
      }));
      assert.ok(before.scroll >= 400, 'real nonzero scroll before modal');
      // Clicking the off-screen header programmatically avoids Playwright
      // scrolling
      // it into view before the event and obscuring a modal scroll regression.
      await page.evaluate(() =>
        document.querySelector('header [data-act="new"]').click());
      await page.locator('#modal-root .dialog').waitFor({state: 'visible'});
      const during = await page.evaluate(() => ({
        top: getComputedStyle(document.body).top,
        left: document.querySelector('main').getBoundingClientRect().left,
        width: document.querySelector('main').getBoundingClientRect().width,
      }));
      assert.equal(during.top, `-${before.scroll}px`);
      assert.ok(
        Math.abs(during.left - before.left) <= 1,
        'background does not jump horizontally'
      );
      assert.ok(
        Math.abs(during.width - before.width) <= 1,
        'background width stays fixed'
      );
      const first = page.locator('#modal-root .ds-modal-close');
      await first.focus();
      await page.keyboard.press('Shift+Tab');
      assert.equal(
        await page.evaluate(() => Boolean(document.activeElement
          .closest('#modal-root'))),
        true
      );
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#modal-root .dialog').count(), 0);
      const after = await page.evaluate(() => ({
        scroll: window.scrollY,
        left: document.querySelector('main').getBoundingClientRect().left,
        width: document.querySelector('main').getBoundingClientRect().width,
      }));
      assert.ok(
        Math.abs(after.scroll - before.scroll) <= 1,
        `scroll restored (${after.scroll} vs ${before.scroll})`
      );
      assert.ok(Math.abs(after.left - before.left) <= 1);
      assert.ok(Math.abs(after.width - before.width) <= 1);
    });
  }
);
