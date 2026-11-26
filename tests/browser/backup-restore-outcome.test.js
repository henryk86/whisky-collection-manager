import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {writeReadableZip} from '../../shared/backup-zip.js';
import {domOnly, session, openSettingsFromMenu, openSettingsSection} from './support.js';

for (const cleanupStatus of ['pending', 'syncUnconfirmed']) {
  test(`browser: committed restore with ${cleanupStatus} cleanup shows a restart notice instead of reloading`, {skip: domOnly}, async () => {
    await session(async ({page, open, base, dir}) => {
      const password = 'SicheresTestpasswort-2026-mindestens-14!';
      const archive = path.join(dir, 'restore-test.zip');
      writeReadableZip(dir, archive, password);
      await open();
      await openSettingsFromMenu(page);
      await openSettingsSection(page, 'backups');
      await page.locator('#backup-admin-key').fill(process.env.BACKUP_ADMIN_TOKEN || 'a'.repeat(64));
      await page.locator('#backup-unlock-form button[type="submit"]').click();
      const upload = page.locator('#backup-import-zip-form');
      await upload.waitFor();
      await upload.locator('[name="archive"]').setInputFiles(archive);
      await upload.locator('[name="password"]').fill(password);
      await upload.locator('button[type="submit"]').click();
      const confirm = page.locator('#backup-apply-zip-form');
      await confirm.waitFor();
      let applied = 0;
      await page.route(`${base}/api/backups/import-zip/*/apply`, async route => {
        applied++;
        assert.deepEqual(route.request().postDataJSON(), {acknowledge: true, password});
        await route.fulfill({status: 200, json: {applied: true, cleanupStatus}});
      });
      await confirm.locator('[name="acknowledge"]').check();
      await confirm.locator('button[type="submit"]').click();
      const warning = page.locator('#modal-root .warning');
      await warning.filter({hasText: 'Speichermedium prüfen und Server neu starten'}).waitFor();
      assert.match(await warning.innerText(), /Nicht erneut wiederherstellen/);
      assert.equal(await confirm.count(), 0);
      assert.equal(applied, 1);
    });
  });
}
