import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { roomTransferMarkup } from '../../public/js/views/warehouse-room-transfer.js';

const rooms = [
    {id:'r1',name:'Room 1',furniture:[{id:'f1'}]},
    {id:'r2',name:'Room 2',furniture:[]}
];

test('one room transfer dialog contains two mutually exclusive tabs and preserves both forms', () => {
    const html = roomTransferMarkup(rooms, 'r2');
    assert.match(html, /role="tablist"/);
    assert.equal((html.match(/role="tab"/g) || []).length,2);
    assert.match(html, /id="warehouse-transfer-tab-export" aria-selected="true"/);
    assert.match(html, /id="warehouse-transfer-panel-import"[^>]+hidden/);
    assert.match(html, /id="warehouse-transfer-panel-export"[^>]*>/);
    assert.match(html, /id="warehouse-room-export-form"/);
    assert.match(html, /id="warehouse-room-import-form"/);
    assert.match(html, /value="r2" checked/);
    assert.match(html, /id="warehouse-transfer-file"/);
    assert.match(html, /id="warehouse-transfer-conflict-policy"/);
    assert.match(html, /id="warehouse-transfer-apply" disabled/);
    assert.equal(html.includes('warehouse-rooms-export'),false);
    assert.equal(html.includes('warehouse-rooms-import'),false);
});

test('import tab is the default for an empty warehouse and export is disabled', () => {
    const html=roomTransferMarkup([]);
    assert.match(html, /id="warehouse-transfer-tab-export"[^>]*disabled/);
    assert.match(html, /id="warehouse-transfer-tab-import" aria-selected="true"/);
    assert.match(html, /id="warehouse-transfer-panel-export"[^>]+hidden/);
    assert.match(html, /id="warehouse-transfer-panel-import"[^>]*>/);
    const css=readFileSync('public/styles/warehouse.css','utf8');
    assert.match(css,/\.warehouse-transfer-panel\[hidden\] \{ display: none; \}/);
});
