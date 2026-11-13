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
        assert.doesNotMatch(html, /import-search|import-panel|import-area|importWhiskybaseData|openWhiskybase|whiskybaseExtensionHint/);
        assert.match(html, /name="whiskybaseId"/);
        assert.match(html, /name="whiskybaseUrl"/);
    }
});

test('public settings do not advertise a bundled browser extension', () => {
    const view = read('public/js/views/settings.js');
    assert.doesNotMatch(view, /whiskybaseExtensionInstructions|beiliegende Browser-Erweiterung/);
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
    assert.doesNotMatch(controller, /function wbSearch\(/);
    assert.match(boot, /externalImport\.importFromExtension\(\)/);
});

test('public WCM Markdown documentation does not name the private source provider', () => {
    const docPaths = ['README.md', 'CHANGELOG.md'];
    const collect = folder => {
        for (const item of fs.readdirSync(folder, { withFileTypes: true })) {
            const path = `${folder}/${item.name}`;
            if (item.isDirectory()) collect(path);
            else if (item.isFile() && item.name.endsWith('.md')) docPaths.push(path);
        }
    };
    collect('docs');
    for (const path of docPaths) {
        assert.doesNotMatch(read(path), /whiskybase/i, `${path} must stay provider-neutral`);
    }
    assert.equal(fs.existsSync('extension/manifest.json'), false, 'no bundled extension');
    assert.equal(fs.existsSync('server/integrations/whiskybase.js'), false, 'no old HTML scraper');
});
