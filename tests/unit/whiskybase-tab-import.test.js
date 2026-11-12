import test from 'node:test';
import assert from 'node:assert/strict';
import { createWhiskybase } from '../../public/js/features/whiskybase/controller.js';

const payload = {
    version: 2, source: 'external',
    fields: {
        whiskybaseId: '54321',
        whiskybaseUrl: 'https://www.whiskybase.com/whiskies/whisky/54321/example',
        name: 'Import in vorhandenem Tab',
    },
};

function mockImport({ openEditor }) {
    const oldLocation = globalThis.location;
    const oldHistory = globalThis.history;
    const oldDocument = globalThis.document;
    const oldSetTimeout = globalThis.setTimeout;
    const calls = [];
    const location = {
        pathname: '/', search: '?bottling=local-bottling',
        hash: '#wcm-import=' + encodeURIComponent(JSON.stringify(payload)),
    };
    globalThis.location = location;
    globalThis.history = { replaceState(...args) {
        calls.push(['history', args[2]]);
        location.hash = '';
    } };
    globalThis.document = { querySelector: () => null,
        createElement: () => ({ remove() {}, className: '', textContent: '' }),
        body: { append(el) { calls.push(['toast', el.textContent]); } } };
    globalThis.setTimeout = () => {}; // prevent nonessential toast timers in this unit test
    const state = {
        collection: { bottlings: [], distilleries: [] },
        modal: openEditor ? { title: 'Abfüllung bearbeiten' } : null,
    };
    const controller = createWhiskybase({
        state,
        navigate: (...args) => calls.push(['navigate', ...args]),
        showModal: (...args) => calls.push(['showModal', ...args]),
        closeModal: (...args) => { calls.push(['closeModal', ...args]); state.modal = null; },
        createBottling: () => calls.push(['createBottling']),
    });
    return {
        calls, controller,
        restore() {
            if (oldLocation === undefined) delete globalThis.location; else globalThis.location = oldLocation;
            if (oldHistory === undefined) delete globalThis.history; else globalThis.history = oldHistory;
            if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
            globalThis.setTimeout = oldSetTimeout;
        },
    };
}

test('incoming hash import is processed in an already open manager tab', () => {
    const { calls, controller, restore } = mockImport({ openEditor: false });
    try {
        controller.importFromExtension();
        assert.deepEqual(calls[0], ['history', '/?bottling=local-bottling']);
        assert.ok(calls.some(call => call[0] === 'navigate' && call[1] === 'home'));
        assert.ok(calls.some(call => call[0] === 'createBottling'));
        assert.ok(!calls.some(call => call[0] === 'showModal'));
        assert.ok(!calls.some(call => call[0] === 'toast'), 'the import should not throw');
    } finally { restore(); }
});

test('incoming hash import does not discard an already open form without confirmation', () => {
    const { calls, controller, restore } = mockImport({ openEditor: true });
    try {
        controller.importFromExtension();
        assert.deepEqual(calls[0], ['history', '/?bottling=local-bottling']);
        const confirmation = calls.find(call => call[0] === 'showModal');
        assert.ok(confirmation, 'requires the in-app confirmation modal');
        assert.equal(confirmation[1], 'Externe Importdaten bereit');
        assert.match(confirmation[2], /ungespeicherte Eingaben/);
        assert.match(confirmation[2], /data-act="wb-import-continue"/);
        assert.equal(confirmation[4], true, 'keep the existing dialog nested underneath');
        assert.ok(!calls.some(call => call[0] === 'navigate'));
        assert.ok(!calls.some(call => call[0] === 'createBottling'));

        controller.confirmPendingImport();
        assert.ok(calls.some(call => call[0] === 'closeModal' && call[1] === true));
        assert.ok(calls.some(call => call[0] === 'navigate' && call[1] === 'home'));
        assert.ok(calls.some(call => call[0] === 'createBottling'));
        assert.ok(!calls.some(call => call[0] === 'toast'), 'the confirmed import should not throw');
    } finally { restore(); }
});

test('a valid no-image import remains valid when preview validates it again', async () => {
    const { validateExtensionPayload } = await import('../../public/js/features/whiskybase/payload.js');
    const once = validateExtensionPayload(payload);
    assert.equal(once.imageToken, null);
    const twice = validateExtensionPayload(once);
    assert.equal(twice.fields.whiskybaseId, '54321');
    assert.equal(twice.imageToken, null);
    assert.throws(() => validateExtensionPayload({ ...payload, imageToken: '../bad-token' }), /Bild-Token/);
});


test('old import fragment is ignored without changing the active form', () => {
    const { calls, controller, restore } = mockImport({ openEditor: true });
    try {
        location.hash = '#whiskybase-import=' + encodeURIComponent(JSON.stringify(payload));
        controller.importFromExtension();
        assert.equal(calls.length, 0);
    } finally { restore(); }
});
