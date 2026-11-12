import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraConfig, scannerFormatNames, supportedFormats } from '../../public/js/features/scanner/config.js';
import { createScanner } from '../../public/js/features/scanner/controller.js';
import { createCodeResolver } from '../../public/js/features/scanner/resolve-code.js';
import { lookupInventoryNumber } from '../../public/js/domain/selectors.js';
import { collectionFixture } from '../helpers/fixtures.js';
function resolverContext(extra = {}) {
    const calls = [];
    const state = {
        collection: collectionFixture(), scanReturn: null
    };
    const resolve = createCodeResolver({
        state,
        navigate: (...args) => calls.push(['navigate', ...args]),
        toast: (...args) => calls.push(['toast', ...args]),
        closeModal: () => calls.push(['close']),
        renderModal: () => calls.push(['modal']),
        ...extra,
    });
    return {
        state, calls, resolve
    };
}
test('scanner retains the 0.5.5 formats and scan-area settings', () => {
    assert.deepEqual(scannerFormatNames, ['QR_CODE', 'CODE_128', 'CODE_39', 'CODE_93', 'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'ITF', 'DATA_MATRIX', 'CODABAR']);
    const options = cameraConfig();
    assert.equal(options.fps, 12);
    assert.deepEqual(options.qrbox(390, 600), {
        width: 358, height: 232
    });
    assert.deepEqual(options.qrbox(600, 390), {
        width: 331, height: 215
    });
    assert.deepEqual(supportedFormats({
        QR_CODE: 0, CODE_128: 1
    }), [0, 1]);
    assert.throws(() => supportedFormats({}), /Scannerformate/);
});
test('known inventory number navigates and highlights without opening any editor', async () => {
    const { resolve, calls } = resolverContext();
    await resolve(' 000123 ');
    assert.deepEqual(calls, [['navigate', 'detail', 'bottling-a', {
                highlightBottleId: 'bottle-a'
            }]]);
});
test('inventory number lookup preserves leading zeroes', () => {
    assert.equal(lookupInventoryNumber(collectionFixture(), '123'), null);
    assert.equal(lookupInventoryNumber(collectionFixture(), '000123').bottle.id, 'bottle-a');
});
test('unknown code only reports the result and never opens an editor', async () => {
    const { resolve, calls } = resolverContext();
    await resolve('unknown');
    assert.equal(calls[0][0], 'close');
    assert.equal(calls[1][0], 'toast');
    assert.equal(calls.filter(call => call[0] === 'navigate').length, 0);
});
test('assigning an existing inventory number is rejected', async () => {
    const { resolve, calls } = resolverContext();
    await resolve('000123', true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'toast');
    assert.match(calls[0][1], /bereits/);
});
test('assigning an unused code restores the bottle form and its unsaved text', async () => {
    const form = {
        elements: {
            inventoryNumber: {
                value: ''
            }, comment: {
                value: ''
            }
        }
    };
    const { state, resolve, calls } = resolverContext({
        query: () => form
    });
    state.scanReturn = {
        modal: {
            title: 'Edit'
        }, values: {
            comment: 'Unsaved'
        }
    };
    await resolve('009999', true);
    assert.equal(form.elements.inventoryNumber.value, '009999');
    assert.equal(form.elements.comment.value, 'Unsaved');
    assert.equal(state.scanReturn, null);
    assert.deepEqual(calls, [['close'], ['modal']]);
});
test('stopping the scanner releases the engine and clears scanner state', async () => {
    const calls = [];
    const state = {
        scanner: {
            engine: {
                stop: async () => calls.push('stop'), clear: async () => calls.push('clear'),
            }
        }
    };
    const scanner = createScanner({
        state, showModal() {
        }, resolveCode() {
        }
    });
    await scanner.stopScan();
    assert.equal(state.scanner, null);
    assert.deepEqual(calls, ['stop', 'clear']);
    await scanner.stopScan();
    assert.deepEqual(calls, ['stop', 'clear']);
});
