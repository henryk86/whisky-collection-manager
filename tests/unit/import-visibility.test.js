import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createBottlingForm } from '../../public/js/features/forms/bottling.js';

const read = file => fs.readFileSync(file, 'utf8');

test('new and existing bottling forms do not advertise the private extension', () => {
    const form = createBottlingForm({
        state: { collection: { distilleries: [] } },
        selectors: { distilleryIds: () => [] },
    });
    for (const bottling of [{}, { id: 'existing', name: 'Example whisky' }]) {
        const html = form(bottling);
        assert.doesNotMatch(html, /import-search|import-panel|import-area/);
        assert.match(html, /name="whiskybaseId"/);
        assert.match(html, /name="whiskybaseUrl"/);
    }
});

test('public settings do not advertise a bundled browser extension', () => {
    const view = read('public/js/views/settings.js');
    assert.doesNotMatch(view, /beiliegende Browser-Erweiterung/);
    const events = read('public/js/events.js');
    assert.doesNotMatch(events, /'import-search'/);
});

test('only the new external payload path is exposed and no static import UI is present', () => {
    const controller = read('public/js/features/import/controller.js');
    const boot = read('public/app.js');
    assert.match(controller, /'#wcm-import='/);
    assert.match(controller, /ensurePreviewPanel\(form\)/);
    assert.match(controller, /validatePayload/);
    const provider = read('public/js/features/whiskybase/controller.js');
    assert.match(provider, /validateExtensionPayload/);
    assert.match(provider, /findExistingBottling/);
    assert.match(boot, /externalImport\.importFromExtension\(\)/);
});
