import test from 'node:test';
import assert from 'node:assert/strict';
import {session, seed, openSettingsSection} from './support.js';

const widths = [390, 768, 1024, 1440];

test(
  'browser: M5 collection and analytics summary cards share surface tokens and stay responsive',
  async () => {
    await session(async ({page, open, base}) => {
      await seed(base, '005500');
      for (const query of ['', '?view=analysis']) {
        await open({query});
        const selector = query ? '.analytics-metric[data-ds-panel="standard"]' : '.stats .panel.stat[data-ds-panel="standard"]';
        await page.locator(selector).first().waitFor({state: 'visible'});
        for (const width of widths) {
          await page.setViewportSize({width, height: 900});
          for (const theme of ['light', 'dark']) {
            await page.evaluate(
              value => {document.documentElement.dataset.theme = value;},
              theme
            );
            const actual = await page.locator(selector).first().evaluate(element => {
              const tokenPanel = getComputedStyle(document.documentElement).getPropertyValue('--ds-color-surface').trim();
              const panel = getComputedStyle(element);
              const canvas = document.createElement('span');
              canvas.style.background = tokenPanel;
              document.body.append(canvas);
              const expected = getComputedStyle(canvas).backgroundColor;
              canvas.remove();
              return {
                background: panel.backgroundColor,
                expected,
                width: element.getBoundingClientRect().width,
                overflow: document.documentElement.scrollWidth - innerWidth,
                nested: element.querySelectorAll('.panel').length,
              };
            });
            assert.equal(actual.background, actual.expected, `${query}/${width}/${theme}: surface`);
            assert.ok(actual.width > 0 && actual.overflow <= 1, `${query}/${width}/${theme}: geometry`);
            assert.equal(actual.nested, 0, 'no unnecessary inner panel');
          }
        }
      }
    });
  }
);

test(
  'browser: M5 legacy import spacing no longer depends on inline attributes',
  async () => {
    await session(async ({page, open}) => {
      await open({query: '?view=settings'});
      await openSettingsSection(page, 'transfer');
      const details = page.locator('.settings-legacy-import');
      await details.waitFor({state: 'visible'});
      assert.equal(await details.getAttribute('style'), null);
      for (const width of [390, 1440]) {
        await page.setViewportSize({width, height: 900});
        const result = await details.evaluate(element => {
          const input = element.querySelector('#import-file');
          const button = element.querySelector('[data-act="import"]');
          return {
            gap: getComputedStyle(element).marginTop,
            inputGap: getComputedStyle(input).marginTop,
            buttonGap: getComputedStyle(button).marginTop,
            inline: Boolean(input.getAttribute('style') || button.getAttribute('style')),
            overflow: document.documentElement.scrollWidth - innerWidth,
          };
        });
        assert.deepEqual([result.gap, result.inputGap, result.buttonGap], ['15px', '10px', '10px']);
        assert.equal(result.inline, false);
        assert.ok(result.overflow <= 1);
      }
    });
  }
);

test(
  'browser: M5 physical-bottle gallery geometry is stable without collection stylesheet overrides',
  async () => {
    await session(async ({page, open, base}) => {
      const {bottling} = await seed(base, '005501');
      await open({query: `?bottling=${bottling.id}`});
      await page.locator('.bottle-entry').first().waitFor();
      const dimensions = await page.evaluate(() => {
        const fixture = document.createElement('div');
        fixture.className = 'photo-tile';
        fixture.innerHTML =
          '<button class="photo-open" type="button"><img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" /></button>';
        document.body.append(fixture);
        const outer = getComputedStyle(fixture);
        const inner = getComputedStyle(fixture.firstElementChild);
        const output = {
          width: outer.width, height: outer.height, innerHeight: inner.height,
          overflow: document.documentElement.scrollWidth - innerWidth,
        };
        fixture.remove();
        return output;
      });
      assert.deepEqual([dimensions.width, dimensions.height, dimensions.innerHeight], ['102px', '137px', '107px']);
      assert.ok(dimensions.overflow <= 1);
    });
  }
);
