import {domElements, domText, assertDom} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {helpView} from '../../public/js/views/help.js';

test(
  'help retains existing short guidance and includes technical accordion guides in the same content panel',
  async () => {
    const html = helpView('backups');
    await assertDom(html, ".help-content-panel");
    await assertDom(html, ".help-technical-guides");
    assert.ok((await domElements(html, '[class="help-guide"]')).length > 0);
    assert.match(await domText(html), /backup-admin-token/);
    assert.match(await domText(html), /rclone config/);
    assert.match(await domText(html), /OneDrive/);
  }
);
