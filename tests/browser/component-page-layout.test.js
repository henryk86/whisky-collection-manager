import {domElements, assertDom} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSettingsView} from '../../public/js/views/settings.js';

test('settings page has a translated, visible punchline', async () => {
  const state = {collection: {settings: {}, distilleries: [], bottlings: []}};
  const html = createSettingsView(state)();
  assert.ok((await domElements(html, '[class="section-head ds-page-header settings-heading"]')).length > 0);
  await assertDom(html, "p[class=\"intro\"]", {"text": new RegExp("^Sprache, Destillerien, Exporte und Datensicherung verwalten\\.$")});
  assert.equal(
    JSON.parse(fs.readFileSync('public/locales/en.json', 'utf8'))['settings.page.intro'],
    'Manage language, distilleries, exports, and backups.'
  );
});
