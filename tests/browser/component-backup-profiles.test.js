import {domElements, domText, assertDom} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderBackupSection, profileForm} from '../../public/js/views/backups.js';

const valid = {
  name: 'Dropbox täglich',
  provider: 'dropbox',
  remote: 'my_dropbox',
  targetPath: 'whisky/backups',
  enabled: true,
  schedule: {frequency: 'daily', hour: 2, minute: 30, weekday: 0},
  retention: {daily: 7, weekly: 4, monthly: 12},
};

test('backup UI escapes names and errors; never renders credentials', async () => {
  const malicious = {
    ...valid, format: 'zip', id: 'fake',
    name: '<script>alert(1)</script>',
  };
  const state = {
    backupUnlocked: true,
    backupDashboard: {
      profiles: [malicious],
      jobs: [{
        state: 'failed',
        error: '<img src=x onerror=alert(1)>',
        profileId: 'fake',
        type: 'run',
      }],
      worker: {online: true},
      snapshots: {},
      remotes: [],
      timeZone: 'Europe/Berlin',
    },
  };
  const html = renderBackupSection(state);
  assert.match(await domText(html), new RegExp("<script>"));
  await assertDom(html, "script, img[src=\"x\"]", {}, true);
  assert.ok((await domElements(html, '[data-act="backup-run"]')).length > 0);
  assert.ok((await domElements(html, '[data-act="backup-restore"]')).length > 0);
  assert.ok((await domElements(profileForm(malicious, ['dropbox']), '[id="backup-profile-form"]')).length > 0);
  assert.match(await domText(profileForm({}, [], [{name: 'usb', label: 'USB-Stick'}])), /AES-256-Passwortschutz/);
  await assertDom(profileForm({}, [], [{name: 'usb', label: 'USB-Stick'}]), 'option[value="usb/whisky-zip"]');
  await assertDom(renderBackupSection({backupUnlocked: false, backupDashboard: null}), "[id=\"backup-admin-key\"]");
});

test(
  'one backup screen provides direct ZIP, scheduled profiles and full restore without a duplicate download',
  async () => {
    const locked = renderBackupSection({
      backupUnlocked: false, backupDashboard: null,
    });
    const unlocked = renderBackupSection({
      backupUnlocked: true, backupDashboard: {
        profiles: [],
        jobs: [],
        worker: {online: true},
        snapshots: {},
        targets: [],
        remotes: [],
        passwordConfigured: true,
      },
    });
    for (const html of [locked, unlocked]) {
      assert.equal((await domElements(html, '[href="/api/export/zip"]')).length, 0);
      assert.match(await domText(html), /Backup direkt herunterladen/);
      assert.match(await domText(html), /Automatische Backups/);
      assert.equal((new RegExp("Wiederherstellen|Backup einspielen").test(await domText(html))), true);
    }
    assert.ok((await domElements(unlocked, '[data-act="backup-manual-download"]')).length > 0);
    assert.ok((await domElements(unlocked, '[id="backup-password-form"]')).length > 0);
    assert.ok((await domElements(unlocked, '[id="backup-import-zip-form"]')).length > 0);
    assert.ok((await domElements(unlocked, '[data-act="backup-new"]')).length > 0);
  }
);

test(
  'version footer is derived from server metadata and ZIP exports require unlock',
  async () => {
    const unlockedNoPassword = renderBackupSection({
      backupUnlocked: true, backupDashboard: {
        profiles: [],
        jobs: [],
        worker: {online: true},
        snapshots: {},
        targets: [],
        remotes: [],
        passwordConfigured: false,
      },
    });
    assert.equal((await domElements(unlockedNoPassword, '[data-act="backup-manual-download"]')).length, 0);
    assert.match(await domText(unlockedNoPassword), /Backup-Passwort festlegen/);
  }
);
