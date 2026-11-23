import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSettingsView} from '../../public/js/views/settings.js';


test('settings page has a translated, visible punchline', () => {
  const state = {collection: {settings: {}, distilleries: [], bottlings: []}};
  const html = createSettingsView(state)();
  assert.match(html, /class="section-head ds-page-header settings-heading"/);
  assert.match(html, /<p class="intro">Sprache, Destillerien, Exporte und Datensicherung verwalten\.<\/p>/);
  assert.equal(JSON.parse(fs.readFileSync('public/locales/en.json', 'utf8'))['settings.page.intro'],
    'Manage language, distilleries, exports, and backups.');
});
