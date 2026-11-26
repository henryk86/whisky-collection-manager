import {domElements, domText, domMatches, domScope, assertDom} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSettingsView} from '../../public/js/views/settings.js';

test(
  'distillery management is fully scrollable as a page, searchable and keeps names escaped',
  async () => {
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
    assert.ok((await domElements(view, '[id="distillery-search"]')).length > 0);
    assert.match(await domText(view), /1 von 3/);
    assert.match(await domText(view), /Port Ellen/);
    assert.ok((await domElements(view, '[data-act="rename-distillery"]')).length > 0);
    assert.ok((await domElements(view, '[class="distillery-list"]')).length > 0);
    assert.equal((await domElements(view, 'script')).length, 0);
    assert.match(await domText(view), new RegExp("A <script>"));
    assert.ok((await domElements(view, '[role="list"]')).length > 0);
    assert.equal((await domMatches(view, ".distillery-management-head") || await domMatches(view, "h3", {text: "Destillerien"})), false);
    assert.equal((await domElements(view, 'h2.analytics-section-title')).filter(node => node.text === "Destillerien").length, 1);
  }
);

test(
  'legacy JSON import is hidden in a collapsed disclosure until the user opens it',
  async () => {
    const state = {
      backupUnlocked: false, backupDashboard: null,
      collection: {distilleries: []}, distillerySearch: '',
    };
    const view = createSettingsView(state)();
    assert.ok((await domElements(view, 'header[class="section-head ds-page-header settings-heading"]')).length > 0);
    await assertDom(view, "span[class=\"eyebrow dark\"]", {"text": new RegExp("^DEINE SAMMLUNG VERWALTEN$")});
    await assertDom(view, "h2:has(> span.heading-period[aria-hidden=\"true\"])", {directText: "Einstellungen & Datensicherung"});
    await assertDom(view, "p.intro", {"text": new RegExp("^Die Sammlung wird lokal gespeichert")}, true);
    assert.ok((await domElements(view, '[data-act="goto-home"]')).length > 0);
    const english = JSON.parse(fs.readFileSync('public/locales/en.json', 'utf8'));
    assert.equal(english['settings.page.eyebrow'], 'MANAGE YOUR COLLECTION');
    assert.ok((await domElements(view, '[data-settings-panel="transfer"][hidden]')).length > 0, 'import/export is not shown in General settings');
    assert.ok((await domElements(view, '[data-settings-section="transfer"]')).length > 0, 'import/export is reachable from the sidebar');
    const disclosure = domScope(view, 'details');
    await assertDom(view, 'details:not([open])', {}, false, 'legacy import should start collapsed');
    await assertDom(disclosure, "summary", {"text": new RegExp("Alte JSON-Datei ohne Bilder importieren")});
    assert.ok((await domElements(disclosure, 'input[type="file"][id="import-file"]')).length > 0);
  }
);
