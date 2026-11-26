import {domText, assertDom} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {jobErrorText} from '../../public/js/i18n/job-errors.js';
import {renderBackupSection} from '../../public/js/views/backups.js';

test(
  'backup job list displays specific structured code, not raw error text',
  async () => {
    const job = {
      id: 'job',
      type: 'run',
      state: 'failed',
      profileId: 'profile',
      errorCode: 'backup.errors.mountMarkerMissing',
      error: '<img src=x onerror=alert(1)>',
    };
    const html = renderBackupSection({
      backupUnlocked: true, backupDashboard: {
        profiles: [],
        targets: [],
        jobs: [job],
        worker: {online: true},
        snapshots: {},
        remotes: [],
        timeZone: 'Europe/Berlin',
      },
    });
    assert.match(await domText(html), /Backup-Marker fehlt/);
    await assertDom(html, "[onerror], img[src=\"x\"]", {}, true);
    assert.equal(
      jobErrorText(job),
      'Backup-Ziel nicht bereit: USB-/NAS-Laufwerk ist nicht korrekt eingehängt (Backup-Marker fehlt).'
    );
  }
);
