import {renderedText, domElements} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSettingsView} from '../../public/js/views/settings.js';

test(
  'distillery management is fully scrollable as a page, searchable and keeps names escaped',
  () => {
    const state = {
      distillerySearch: 'Port',
      collection: {
        distilleries: [
          {id: 'a', name: 'Ardbeg'}, {id: 'b', name: 'Port Ellen'},
          {id: 'c', name: 'A <script>alert(1)</script>'},
        ],
      },
    };
    const view = createSettingsView(state)();
    assert.ok(domElements(view, '[id="distillery-search"]').length > 0);
    assert.match(renderedText(view), /1 von 3/);
    assert.match(renderedText(view), /Port Ellen/);
    assert.ok(domElements(view, '[data-act="rename-distillery"]').length > 0);
    assert.ok(domElements(view, '[class="distillery-list"]').length > 0);
    assert.equal(domElements(view, 'script').length, 0);
    assert.match(renderedText(view), /A &lt;script&gt;/);
    assert.ok(domElements(view, '[role="list"]').length > 0);
    assert.doesNotMatch(renderedText(view), /class="distillery-management-head"|<h3>Destillerien<\/h3>/);
    assert.equal((renderedText(view).match(/<h2 class="analytics-section-title">Destillerien<\/h2>/g) || []).length, 1);
  }
);

test(
  'legacy JSON import is hidden in a collapsed disclosure until the user opens it',
  () => {
    const state = {
      backupUnlocked: false, backupDashboard: null,
      collection: {distilleries: []}, distillerySearch: '',
    };
    const view = createSettingsView(state)();
    assert.ok(domElements(view, 'header[class="section-head ds-page-header settings-heading"]').length > 0);
    assert.match(renderedText(view), /<span class="eyebrow dark">DEINE SAMMLUNG VERWALTEN<\/span>/);
    assert.match(
      renderedText(view),
      new RegExp(
        '<h2>Einstellungen &amp; Datensicherung<spa' + 'n class="heading-period" aria-hidden="true' +
        '">\\.<\\/span><\\/h2>'
      )
    );
    assert.doesNotMatch(renderedText(view), /<p class="intro">Die Sammlung wird lokal gespeichert/);
    assert.ok(domElements(view, '[data-act="goto-home"]').length > 0);
    const english = JSON.parse(fs.readFileSync('public/locales/en.json', 'utf8'));
    assert.equal(renderedText(english['settings.page.eyebrow']), 'MANAGE YOUR COLLECTION');
    assert.ok(domElements(view, '[data-settings-panel="transfer"][hidden]').length > 0, 'import/export is not shown in General settings');
    assert.ok(domElements(view, '[data-settings-section="transfer"]').length > 0, 'import/export is reachable from the sidebar');
    const disclosure = renderedText(view).match(/<details([^>]*)>([\s\S]*?)<\/details>/);
    assert.ok(disclosure, 'JSON import should be inside a details disclosure');
    assert.doesNotMatch(renderedText(disclosure[1]), /\bopen\b/, 'legacy import should start collapsed');
    assert.match(renderedText(disclosure[2]), /<summary>Alte JSON-Datei ohne Bilder importieren/);
    assert.ok(domElements(disclosure[2], 'input[type="file"][id="import-file"]').length > 0);
  }
);
