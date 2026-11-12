import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { importChoice } from '../../public/js/features/whiskybase/choice-template.js';

test('Whiskybase preview option keeps one checkbox, field name and value in a clickable label', () => {
    const html = importChoice({ field: 'abv', label: 'Alkoholgehalt (%)', value: 46, checked: true });
    assert.match(html, /^<label class="wb-choice">/);
    assert.match(html, /<input type="checkbox" data-wb-field="abv" checked>/);
    assert.match(html, /class="wb-choice-copy"/);
    assert.match(html, /class="wb-choice-label">Alkoholgehalt \(%\)<\/span>/);
    assert.match(html, /class="wb-choice-value">46<\/span>/);
    assert.equal((html.match(/type="checkbox"/g) || []).length, 1);
});

test('Whiskybase preview options escape incoming fields and show current values', () => {
    const html = importChoice({ field: 'name', label: 'Whiskyname', value: '<script>alert(1)</script>', currentValue: 'ALT & Neu', checked: false });
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(html.includes('Aktuell: ALT &amp; Neu'));
    assert.ok(!html.includes(' checked'));
});

test('unknown distillery is unselectable but still visible with a clear explanation', () => {
    const html = importChoice({ distillery: true, label: 'Destillerie', value: 'Neue Brennerei', disabled: true });
    assert.match(html, /name="wb-distillery" disabled/);
    assert.match(html, /Nicht gefunden/);
});

test('Whiskybase preview CSS resets generic input height and retains responsive layout', () => {
    const css = fs.readFileSync('public/styles/core.css', 'utf8');
    const checkboxRule = css.match(/\.wb-choice input\[type="checkbox"\]\s*\{([^}]+)\}/)?.[1];
    assert.ok(checkboxRule, 'missing scoped checkbox rules');
    assert.match(checkboxRule, /width:\s*18px\s*;/);
    assert.match(checkboxRule, /height:\s*18px\s*;/);
    assert.match(checkboxRule, /min-height:\s*18px\s*;/);
    assert.match(checkboxRule, /padding:\s*0\s*;/);
    assert.match(checkboxRule, /margin:\s*0\s*;/);
    assert.match(css, /\.wb-choice-list\s*\{[^}]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/s);
    assert.match(css, /@media\s*\(max-width:\s*680px\)[^}]*\.wb-choice-list\s*\{\s*grid-template-columns:\s*1fr\s*;/s);
    const controller = fs.readFileSync('public/js/features/whiskybase/controller.js', 'utf8');
    assert.match(controller, /importChoice\(/);
    assert.match(controller, /class="wb-choice-list"/);
    assert.match(controller, /\[data-wb-field\]:checked/);
    assert.match(controller, /\[name=wb-distillery\]:checked/);
    const dark = fs.readFileSync('public/styles/themes.css', 'utf8');
    assert.match(dark, /:root\[data-theme="dark"\] \.wb-choice:has\(input:checked\)\s*\{[^}]*border-color:\s*var\(--gold\)/s);
});

test('actual Whiskybase controller renders aligned selection cards without changing import defaults', async () => {
    const { createWhiskybase } = await import('../../public/js/features/whiskybase/controller.js');
    const oldDocument = globalThis.document;
    let panel = null;
    const fields = { insertBefore: element => { panel = element; }, prepend: element => { panel = element; } };
    const form = {
        elements: { name: { value: '' }, abv: { value: '43' }, bottler: { value: '' } },
        dataset: {},
        querySelector: selector => ({ '.forms': fields, '#wb-panel': panel }[selector] ?? null),
        querySelectorAll: () => [],
    };
    globalThis.document = {
        querySelector: selector => selector === '#bottling-form' ? form : null,
        createElement: () => ({ innerHTML: '', setAttribute: () => {} }),
    };
    try {
        const controller = createWhiskybase({
            state: { collection: { distilleries: [{ id: 'd-1', name: 'Kilchoman' }] } },
        });
        controller.wbPreview({
            version: 2, source: 'external', distilleryName: 'Kilchoman',
            fields: {
                whiskybaseId: '15555', whiskybaseUrl: 'https://www.whiskybase.com/whiskies/whisky/15555/test',
                name: 'Kilchoman Inaugural Release', abv: 46, bottler: 'Distillery Bottling',
            },
        });
        assert.equal(panel.id, 'wb-panel', 'preview holder created only after payload arrives');
        assert.match(panel.className, /wb-area/);
        assert.match(panel.innerHTML, /class="wb-choice-list" role="group"/);
        assert.match(panel.innerHTML, /name="wb-distillery" value="d-1" checked/);
        assert.match(panel.innerHTML, /data-wb-field="name" checked/);
        assert.match(panel.innerHTML, /data-wb-field="abv">/); // Existing value: unchecked by default
        assert.match(panel.innerHTML, /Aktuell: 43/);
        assert.match(panel.innerHTML, /data-act="wb-apply"/);
        assert.equal((panel.innerHTML.match(/<label class="wb-choice">/g) ?? []).length, 6);
    } finally {
        if (oldDocument === undefined) delete globalThis.document;
        else globalThis.document = oldDocument;
    }
});
