import {domElements, assertDom} from './component-dom.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {roomTransferMarkup} from '../../public/js/views/warehouse-room-transfer.js';

const rooms = [{id: 'r1', name: 'Room 1', furniture: [{id: 'f1'}]}, {id: 'r2', name: 'Room 2', furniture: []},];

test(
  'one room transfer dialog contains two mutually exclusive tabs and preserves both forms',
  async () => {
    const html = roomTransferMarkup(rooms, 'r2');
    assert.ok((await domElements(html, '[role="tablist"]')).length > 0);
    assert.equal((await domElements(html, '[role="tab"]')).length, 2);
    assert.ok((await domElements(html, '[id="warehouse-transfer-tab-export"][aria-selected="true"]')).length > 0);
    assert.ok((await domElements(html, '[id="warehouse-transfer-panel-import"][hidden]')).length > 0);
    assert.ok((await domElements(html, '[id="warehouse-transfer-panel-export"]')).length > 0);
    assert.ok((await domElements(html, '[id="warehouse-room-export-form"]')).length > 0);
    assert.ok((await domElements(html, '[id="warehouse-room-import-form"]')).length > 0);
    assert.ok((await domElements(html, '[value="r2"][checked]')).length > 0);
    assert.ok((await domElements(html, '[id="warehouse-transfer-file"]')).length > 0);
    assert.ok((await domElements(html, '[id="warehouse-transfer-conflict-policy"]')).length > 0);
    assert.ok((await domElements(html, '[id="warehouse-transfer-apply"][disabled]')).length > 0);
    await assertDom(html, '[data-act="warehouse-rooms-export"]', {}, true);
    await assertDom(html, '[data-act="warehouse-rooms-import"]', {}, true);
  }
);

test(
  'import tab is the default for an empty warehouse and export is disabled',
  async () => {
    const html = roomTransferMarkup([]);
    assert.ok((await domElements(html, '[id="warehouse-transfer-tab-export"][disabled]')).length > 0);
    assert.ok((await domElements(html, '[id="warehouse-transfer-tab-import"][aria-selected="true"]')).length > 0);
    assert.ok((await domElements(html, '[id="warehouse-transfer-panel-export"][hidden]')).length > 0);
    assert.ok((await domElements(html, '[id="warehouse-transfer-panel-import"]')).length > 0);
  }
);
