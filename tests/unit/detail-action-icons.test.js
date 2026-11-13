import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createDetailView } from '../../public/js/views/detail.js';
import { createBottleForm } from '../../public/js/features/forms/bottle.js';
import { inventoryScanIcon, editIcon, deleteIcon } from '../../public/js/ui/action-icons.js';

function button(html, action) {
    const found = html.match(new RegExp(String.raw`<button\b[^>]*data-act="${action}"[^>]*>[\s\S]*?<\/button>`));
    assert.ok(found, `${action} button is missing`);
    return found[0];
}

function detailMarkup({photos = []} = {}) {
    const originalDocument = globalThis.document;
    globalThis.document = { querySelectorAll: () => [] };
    try {
        let html = '';
        createDetailView({
            state: {
                selected: 'bottling-a',
                collection: { bottlings: [{ id: 'bottling-a', name: 'Example Whisky', bottles: [] }] },
            },
            selectors: {
                bottles: () => [{
                    id: 'physical-a', inventoryNumber: '001', status: 'closed',
                    photos, files: [{ id: 'file-a', name: 'Beleg.pdf', size: 1234 }],
                }],
                coverPhoto: () => '',
                distilleryNames: () => '',
            },
            shell: markup => { html = markup; },
            navigate: () => { throw Error('Unexpected navigation'); },
            action: async fn => fn(),
        })();
        return html;
    } finally {
        if (originalDocument === undefined) delete globalThis.document;
        else globalThis.document = originalDocument;
    }
}

test('the physical-bottle edit dialog uses the same scanner SVG as the header', () => {
    const owner = { id: 'bottling-a', name: 'Example Whisky' };
    const form = createBottleForm({
        state: { collection: { bottlings: [owner] } },
        selectors: { distilleryNames: () => '' },
    })({ id: 'physical-a' }, owner.id);
    const scan = button(form, 'scan-into-bottle');
    assert.ok(scan.includes(inventoryScanIcon));
    assert.ok(scan.includes('<span>Etikett scannen</span>'));
    assert.doesNotMatch(scan, /▣|<text/);
});

test('the bottling and individual-bottle buttons show edit and delete SVGs before labels', () => {
    const html = detailMarkup();
    for (const action of ['edit-bottling', 'edit-bottle']) {
        assert.ok(button(html, action).includes(`${editIcon}<span>Bearbeiten</span>`), action);
    }
    for (const action of ['delete-bottling', 'delete-bottle', 'delete-file']) {
        assert.ok(button(html, action).includes(`${deleteIcon}<span>Löschen</span>`), action);
    }
    assert.match(button(html, 'delete-file'), /aria-label="Datei Beleg\.pdf löschen"/);
    const css = fs.readFileSync('public/styles/themes.css', 'utf8');
    assert.match(css, /\.action-icon\s*\{[^}]*width:\s*17px;[^}]*height:\s*17px;/);
});

test('the redundant photo ownership note is absent from the detail page', () => {
    assert.doesNotMatch(detailMarkup(), /Fotos gehören jeweils einer physischen Flasche/);
});

test('photo editor uses only the shared pencil icon, with an accessible tooltip like the cutout button', () => {
    const html = detailMarkup({photos: [{id: 'photo-a', path: 'bottle.webp'}]});
    const edit = button(html, 'photo-editor-open');
    assert.doesNotMatch(html, /data-act="cutout-open"/, 'no redundant second gallery button');
    assert.ok(edit.includes(editIcon), 'the existing pencil icon is reused');
    assert.match(edit, /title="Flaschenbild bearbeiten"/);
    assert.match(edit, /aria-label="Flaschenbild bearbeiten"/);
    assert.doesNotMatch(edit, /Anpassen|Adjust/);
    const css = fs.readFileSync('public/styles/bottle-details.css', 'utf8');
    assert.match(css, /\.photo-tile \.photo-edit-trigger \{[^}]*width: 28px; height: 28px;/);
    assert.match(css, /\.photo-tile \.photo-edit-trigger \.action-icon \{[^}]*width: 16px; height: 16px;/);
});
