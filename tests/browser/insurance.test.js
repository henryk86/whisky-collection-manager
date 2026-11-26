import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {session, domOnly} from './support.js';
import {requestJson} from '../helpers/server.js';

const original = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABgAAAAqCAIAAAAmpwwJAAAALUlEQVR4nO3MMQ0AMAgAsDFn2MAG/hNMwNcKaGT12/BXFpFIJBKJRCKRSHQSDaMuAWIphFaeAAAAAElFTkSuQmCC', 'base64');
const receipt = Buffer.from('%PDF-1.4\nEvidence fixture\n%%EOF\n');

test('browser: insurance checklist, purchase evidence and local PDF/ZIP downloads', async () => {
  await session(async ({base, page, open}) => {
    const created = await requestJson(base, '/api/bottlings', 'POST', {name: 'Insurance Whisky', firstBottle: {inventoryNumber: '000123', purchasePrice: 25, currency: 'EUR', purchaseDate: '2026-11-01'}});
    assert.equal(created.status, 201);
    const id = created.data.bottle.id;
    assert.equal((await requestJson(base, `/api/bottles/${id}/photos`, 'POST', {image: `data:image/png;base64,${original.toString('base64')}`})).status, 201);
    assert.equal((await requestJson(base, `/api/bottles/${id}/files`, 'POST', {filename: 'Rechnung.pdf', data: `data:application/pdf;base64,${receipt.toString('base64')}`})).status, 201);
    assert.equal((await requestJson(base, '/api/bottles', 'POST', {bottlingId: created.data.bottling.id, inventoryNumber: '000124', volumeType: 'sample', volumeMl: 30})).status, 201);
    await open({query: `?bottling=${created.data.bottling.id}`});
    const mark = page.locator('[data-act="mark-purchase-evidence"]');
    await mark.click();
    await page.locator('[data-act="mark-purchase-evidence"][aria-pressed="true"]').waitFor();
    await page.locator('#menu-button').click();
    await page.locator('#site-drawer [data-act="goto-analysis"]').click();
    await page.locator('[data-act="analytics-section"][data-section="insurance"]').first().click();
    await page.locator('[data-act="insurance-export"][data-format="summary"]').waitFor();
    assert.match(await page.locator('.analytics-section-title').innerText(), /Versicherungsdokumentation/);
    assert.equal(await page.locator('.analytics-metric').first().locator('strong').innerText(), '1');
    assert.equal(await page.locator('[data-act="insurance-missing"][data-key="receipt"]').count(), 0);
    await page.locator('[data-act="insurance-samples"]').click();
    assert.equal(await page.locator('.analytics-metric').first().locator('strong').innerText(), '2');
    await page.locator('[data-act="insurance-missing"][data-key="receipt"]').click();
    assert.match(await page.locator('.analytics-table').innerText(), /000124/);
    assert.doesNotMatch(await page.locator('.analytics-table').innerText(), /000123/);
    await page.locator('[data-act="insurance-samples"]').click();
    await page.setViewportSize({width: 390, height: 900});
    assert.ok(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth));
    if (!domOnly) {
      for (const format of ['summary', 'detail', 'zip']) {
        const [download] = await Promise.all([page.waitForEvent('download'), page.locator(`[data-act="insurance-export"][data-format="${format}"]`).click()]);
        const bytes = fs.readFileSync(await download.path());
        if (format === 'zip') {
          assert.equal(bytes.readUInt32LE(0), 0x04034b50);
          assert.ok(bytes.includes(original));
          assert.ok(bytes.includes(receipt));
          assert.ok(bytes.includes(Buffer.from('manifest.json')));
        } else assert.equal(bytes.subarray(0, 8).toString(), '%PDF-1.4');
      }
    }
  });
});
