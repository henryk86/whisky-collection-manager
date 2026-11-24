import test from 'node:test';
import assert from 'node:assert/strict';
import {session, seed} from './support.js';

/**
 * Coordinates asynchronous work for go.
 *
 * @param {*} page Page or view being rendered or selected.
 * @param {*} action Operation or action callback to invoke.
 * @param {function(...*): *} selector Selector used to obtain matching values.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
async function go(page, action, selector) {
  await page.locator('header [data-act="toggle-menu"]').click();
  await page.locator(`#site-drawer [data-act="${action}"]`).click();
  await page.locator(selector).waitFor({state: 'visible'});
}

/**
 * Updates the DOM elements managed by measured.
 * @return {!Object} Structured result assembled from the input data.
 */
const measured = () => {
  const head = document.querySelector('.ds-page-header');
  const title = head.querySelector('h2');
  const copy = head.firstElementChild;
  const style = getComputedStyle(head);
  const rect = head.getBoundingClientRect();
  const header = document.querySelector('.site-header').getBoundingClientRect();
  const back = head.querySelector('.ds-back-button');
  return {
    titleSize: parseFloat(getComputedStyle(title).fontSize),
    titleLineHeight: parseFloat(getComputedStyle(title).lineHeight),
    topGap: rect.top - header.bottom,
    marginTop: parseFloat(style.marginTop), gap: parseFloat(style.gap),
    titleTop: title.getBoundingClientRect().top,
    actionsTop: back?.getBoundingClientRect().top,
    copyWidth: copy.getBoundingClientRect().width,
    titleWidth: title.getBoundingClientRect().width,
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    arrowCount: back?.querySelectorAll('svg').length || 0,
    arrowText: back?.textContent.trim(),
    hasGlyph: !!back && /[←⟵⬅]/u.test(back.textContent),
  };
};

test(
  'browser: shared page headers have computed geometry and exactly one arrow in both themes at four widths',
  async () => {
    await session(async ({page, open}) => {
      await open();
      for (const width of [390, 768, 1024, 1440]) {
        await page.setViewportSize({width, height: 900});
        for (const theme of ['light', 'dark']) {
          await page.evaluate(
            theme => {
              document.documentElement.dataset.theme =
                theme; document.documentElement.style.colorScheme =
                  theme;
            },
            theme
          );
          const pages = [
            ['goto-analysis', '.analytics-page-heading'],
            ['goto-warehouse', '.warehouse-heading'],
            ['goto-settings-menu', '.settings-heading'],
            ['goto-help', '.help-heading'],
            ['goto-map', '.map-heading'],
          ];
          let baseline = null;
          for (const [action, selector] of pages) {
            await go(page, action, selector);
            const value = await page.evaluate(measured);
            const context = `${action} ${width}px ${theme}`;
            assert.equal(value.marginTop, 20, `${context}: page top margin`);
            assert.equal(value.gap, 14, `${context}: shared header gap`);
            assert.ok(value.copyWidth > 0, `${context}: title copy exists`);
            assert.ok(value.titleSize >= 26, `${context}: legible title`);
            assert.ok(value.overflow <= 1, `${context}: no overflow`);
            if (!baseline) baseline = value;
            else assert.ok(
              Math.abs(value.topGap - baseline.topGap) <= 1,
              `${context}: global header-to-heading spacing ${value.topGap} vs ${baseline.topGap}`
            );
            if (value.arrowCount) {
              assert.equal(value.arrowCount, 1, `${context}: one SVG`);
              assert.equal(value.hasGlyph, false, `${context}: no text arrow`);
            }
            const parent = page.locator(selector);
            assert.equal(
              await parent.locator('h2').count(),
              1,
              `${context}: one title`
            );
          }
        }
      }
    });
  }
);

test(
  'browser: back navigation preserves exact inline spacing and DOM action across detail and tasting pages',
  async () => {
    await session(async ({page, open, base}) => {
      const {bottling} = await seed(base, '008044');
      await open({query: `?bottling=${bottling.id}`});
      for (const width of [390, 768, 1024, 1440]) {
        await page.setViewportSize({width, height: 900});
        const value = await page.locator('.ds-back-nav--inline')
          .evaluate(nav => {
            const button = nav.querySelector('button');
            const icon = button.querySelector('svg').getBoundingClientRect();
            const text = button.querySelector('span').getBoundingClientRect();
            const navRect = nav.getBoundingClientRect();
            return {
              paddingTop: parseFloat(getComputedStyle(nav).paddingTop),
              marginBottom: parseFloat(getComputedStyle(nav).marginBottom),
              gap: text.left - icon.right,
              iconSize: icon.width,
              iconCenter: icon.top + icon.height / 2,
              textCenter: text.top + text.height / 2,
              navWidth: navRect.width,
              overflow: document.documentElement.scrollWidth -
                window.innerWidth,
            };
          });
        assert.equal(value.paddingTop, 8);
        assert.equal(value.marginBottom, 18);
        assert.ok(
          Math.abs(value.gap - 6) <= .5,
          `inline icon/text gap at ${width}`
        );
        assert.equal(value.iconSize, 18);
        assert.ok(
          Math.abs(value.iconCenter - value.textCenter) <= 2,
          `inline vertical alignment at ${width}`
        );
        assert.ok(value.overflow <= 1);
        assert.equal(
          await page.locator('.ds-back-nav--inline [data-act="back"] svg')
            .count(),
          1
        );
      }
      await page.locator('.ds-back-nav--inline [data-act="back"]').click();
      await page.locator('.collection-heading').waitFor({state: 'visible'});
    });
  }
);

test(
  'browser: help icon keeps heading size and baseline while nested flight modal retains its inputs',
  async () => {
    await session(async ({page, open}) => {
      await open();
      await go(page, 'goto-tastings-home', '.tasting-flight-home');
      for (const width of [390, 1440]) {
        await page.setViewportSize({width, height: 900});
        const metrics = await page.locator('.tasting-flight-home .ds-help-icon-button').evaluate(button => {
          const title = button.closest('h3');
          const rect = title.getBoundingClientRect();
          const a = button.getBoundingClientRect();
          const style = getComputedStyle(title);
          return {
            sameCenter: Math.abs(rect.top + rect.height / 2 - a.top -
              a.height / 2),
            height: rect.height,
            marginBottom: style.marginBottom,
            textLine: parseFloat(style.lineHeight),
            buttonSize: a.width,
            paddingRight: parseFloat(style.paddingRight),
          };
        });
        assert.ok(metrics.sameCenter <= 2);
        assert.ok(metrics.buttonSize <= 20);
        assert.equal(metrics.paddingRight, 26);
        assert.ok(
          metrics.height <= metrics.textLine + 1,
          `${width}: help does not increase title line box`
        );
      }
      await page.locator('.tasting-flight-home [data-act="flight-plan-new"]')
        .click();
      await page.locator('#modal-root [data-flight-name]')
        .fill('Unchanged plan');
      const modal = page.locator('#modal-root .dialog-head');
      const align = await modal.evaluate(head => {
        const title = head.querySelector('h2').getBoundingClientRect();
        const help = head.querySelector('.ds-help-icon-button')
          .getBoundingClientRect();
        return Math.abs(title.top + title.height / 2 - help.top -
          help.height / 2);
      });
      assert.ok(align <= 2);
      await modal.locator('.ds-help-icon-button').click();
      await page.locator('#modal-root .flight-plan-help').waitFor();
      await page.locator('#modal-root .dialog-head [data-act="close-modal"]')
        .click();
      assert.equal(
        await page.locator('#modal-root [data-flight-name]').inputValue(),
        'Unchanged plan'
      );
    });
  }
);

test(
  'browser: German and English back-navigation labels never contain text arrows',
  async () => {
    await session(async ({page, open}) => {
      for (const [lang, label] of [['de', 'Zur Sammlung'], ['en', 'Back to collection']]) {
        await open({query: `?view=settings&lang=${lang}`});
        await page.locator('.settings-heading .ds-back-button').waitFor();
        const button = page.locator('.settings-heading .ds-back-button');
        assert.equal((await button.innerText()).trim(), label);
        assert.equal(await button.locator('svg').count(), 1);
        assert.equal(
          await button.getAttribute('aria-label'),
          null,
          'accessible name is supplied by labelled text'
        );
        const nav = page.locator('.settings-heading .ds-back-nav');
        assert.equal(await nav.getAttribute('aria-label'), label);
      }
      await page.locator('.settings-heading [data-act="goto-home"]').click();
      await page.locator('.collection-heading').waitFor({state: 'visible'});
    });
  }
);
