import test from 'node:test';
import assert from 'node:assert/strict';
import {session} from './support.js';

/** M1 contract: semantic aliases and the shared frame keep the existing UI. */
test('browser: design tokens preserve themes and responsive page geometry', async () => {
  await session(async ({page, open}) => {
    await open();
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({width, height: 900});
      for (const theme of ['light', 'dark']) {
        await page.evaluate(value => {
          document.documentElement.dataset.theme = value;
          document.documentElement.style.colorScheme = value;
        }, theme);
        const result = await page.evaluate(() => {
          const root = getComputedStyle(document.documentElement);
          const token = name => root.getPropertyValue(name).trim();
          const main = document.querySelector('main');
          const header = document.querySelector('.header-inner');
          const swatch = document.createElement('div');
          swatch.style.cssText = 'position:absolute;visibility:hidden;background:var(--ds-color-page);color:var(--ds-color-text);border:1px solid var(--ds-color-border)';
          document.body.append(swatch);
          const visual = getComputedStyle(swatch);
          const control = document.createElement('input');
          control.style.cssText = 'position:absolute;visibility:hidden';
          document.body.append(control);
          const button = document.createElement('button');
          button.className = 'btn';
          button.style.cssText = 'position:absolute;visibility:hidden';
          document.body.append(button);
          const panel = document.querySelector('.panel');
          const values = {
            page: visual.backgroundColor,
            ink: visual.color,
            border: visual.borderTopColor,
            mainPadding: parseFloat(getComputedStyle(main).paddingInlineStart),
            mainMax: parseFloat(getComputedStyle(main).maxWidth),
            headerMax: parseFloat(getComputedStyle(header).maxWidth),
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            spacing: token('--ds-space-7'),
            radius: token('--ds-surface-radius'),
            font: token('--ds-font-display'),
            controlBackground: getComputedStyle(control).backgroundColor,
            buttonBackground: getComputedStyle(button).backgroundColor,
            panelBackground: panel ? getComputedStyle(panel).backgroundColor : null,
            panelRadius: panel ? getComputedStyle(panel).borderRadius : null,
          };
          swatch.remove();
          control.remove();
          button.remove();
          return values;
        });
        const label = `${width}px ${theme}`;
        assert.equal(result.page, theme === 'dark' ? 'rgb(16, 25, 35)' : 'rgb(247, 245, 239)', label);
        assert.equal(result.ink, theme === 'dark' ? 'rgb(230, 237, 244)' : 'rgb(30, 50, 69)', label);
        assert.equal(result.border, theme === 'dark' ? 'rgb(51, 68, 84)' : 'rgb(228, 225, 218)', label);
        assert.equal(result.mainPadding, width <= 740 ? 14 : 30, label);
        assert.equal(result.mainMax, 1350, label);
        assert.equal(result.headerMax, 1350, label);
        assert.equal(result.spacing, '20px', label);
        assert.equal(result.radius, '0px', label);
        assert.ok(result.font.includes('Georgia'), label);
        assert.equal(result.controlBackground, theme === 'dark' ? 'rgb(17, 30, 43)' : 'rgb(255, 254, 250)', label);
        assert.equal(result.buttonBackground, theme === 'dark' ? 'rgb(35, 53, 71)' : 'rgb(255, 254, 250)', label);
        assert.equal(result.panelBackground, theme === 'dark' ? 'rgb(24, 37, 50)' : 'rgb(255, 254, 250)', label);
        assert.equal(result.panelRadius, '0px', label);
        assert.ok(result.overflow <= 1, `no horizontal overflow at ${label}`);
      }
    }
  });
});
