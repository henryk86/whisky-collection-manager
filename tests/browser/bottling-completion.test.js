import test from 'node:test';
import assert from 'node:assert/strict';
import {session, seed} from './support.js';
import {requestJson} from '../helpers/server.js';

/** Reads the persisted bottling, independent of the browser's resource cache. */
async function persisted(base, id) {
  const {data} = await requestJson(base, '/api/collection');
  return data.bottlings.find(entry => entry.id === id);
}

test('browser: split edit action changes only completion, persists and supports undo', async () => {
  await session(async ({page, open, base}) => {
    const {bottling} = await seed(base);
    const before = await persisted(base, bottling.id);
    await open();
    await page.locator(`.whisky-card[data-id="${bottling.id}"]`).click();
    const toggle = page.locator('[data-split-toggle]');
    const menu = page.locator('#bottling-edit-actions');
    const item = menu.locator('[data-act="set-bottling-completion"]');
    const patches = [];
    page.on('request', request => {
      if (request.method() === 'PATCH' && request.url().endsWith(`/api/bottlings/${bottling.id}`)) patches.push(request.postDataJSON());
    });
    assert.equal(await menu.isVisible(), false);
    await toggle.click();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(await item.innerText(), 'Als vollständig markieren');
    assert.equal(patches.length, 0, 'opening the menu must not mutate');
    await item.focus();
    await page.keyboard.press('Escape');
    assert.equal(await menu.isVisible(), false);
    assert.equal(await toggle.evaluate(element => document.activeElement === element), true);
    await toggle.click();
    await page.locator('.detail-page-head h2').click();
    assert.equal(await menu.isVisible(), false);
    assert.equal(patches.length, 0);
    await page.locator('[data-act="edit-bottling"]').click();
    await page.locator('#bottling-form').waitFor();
    await page.locator('#bottling-form [data-act="close-modal"]').click();
    assert.equal(patches.length, 0, 'ordinary edit remains unchanged');
    await toggle.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    assert.equal(await item.evaluate(element => document.activeElement === element), true);
    await page.keyboard.press('Enter');
    await page.locator('.toast-action').waitFor();
    assert.deepEqual(patches, [{completionStatus: 'complete'}]);
    const after = await persisted(base, bottling.id);
    assert.deepEqual({...after, completionStatus: before.completionStatus, updatedAt: before.updatedAt}, before);
    await toggle.click();
    assert.equal(await item.innerText(), 'Als unvollständig markieren');
    await page.keyboard.press('Escape');
    await page.locator('.toast-action').click();
    await page.locator('.toast').filter({hasText: 'Abfüllung als unvollständig markiert.'}).waitFor();
    assert.equal((await persisted(base, bottling.id)).completionStatus, 'incomplete');
    assert.deepEqual(patches, [{completionStatus: 'complete'}, {completionStatus: 'incomplete'}]);
    await toggle.click();
    await item.click();
    await page.locator('.toast-action').waitFor();
    await page.locator('[data-act="back"]').first().click();
    await page.locator(`.whisky-card[data-id="${bottling.id}"]`).click();
    await toggle.click();
    assert.equal(await item.innerText(), 'Als unvollständig markieren');
    await item.click();
    await page.locator('.toast').filter({hasText: 'Abfüllung als unvollständig markiert.'}).waitFor();
    assert.equal((await persisted(base, bottling.id)).completionStatus, 'incomplete');
  });
});

test('browser: completion disclosure stays touchable and a rejected PATCH leaves the status unchanged', async () => {
  await session(async ({page, open, base}) => {
    const {bottling} = await seed(base);
    await open();
    await page.locator(`.whisky-card[data-id="${bottling.id}"]`).click();
    const toggle = page.locator('[data-split-toggle]');
    const menu = page.locator('#bottling-edit-actions');
    const item = menu.locator('[data-act="set-bottling-completion"]');
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({width, height: 844});
      await toggle.click();
      const rect = await menu.boundingBox();
      const arrow = await toggle.boundingBox();
      const edit = await page.locator('[data-act="edit-bottling"]').boundingBox();
      assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1, `menu at ${width}px`);
      assert.ok(arrow.width >= 40 && arrow.height >= 40, `touch target at ${width}px`);
      assert.ok(edit.x + edit.width <= arrow.x + 2, 'separate primary and secondary targets');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);
      await page.keyboard.press('Escape');
    }
    let rejected = 0;
    await page.route(`${base}/api/bottlings/${bottling.id}`, async route => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      rejected++;
      await route.fulfill({status: 500, contentType: 'application/json', body: '{}'});
    });
    await toggle.click();
    await item.click();
    await page.locator('.toast.error').waitFor();
    assert.equal(rejected, 1);
    assert.equal((await persisted(base, bottling.id)).completionStatus, 'incomplete');
    assert.equal(await page.locator('.toast-action').count(), 0);
    await toggle.click();
    assert.equal(await item.innerText(), 'Als vollständig markieren');
  });
});
