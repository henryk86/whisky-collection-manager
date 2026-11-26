import {renderedText, domElements} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {roomTransferMarkup}
  from '../../public/js/views/warehouse-room-transfer.js';

const rooms = [{id: 'r1', name: 'Room 1', furniture: [{id: 'f1'}]}, {id: 'r2', name: 'Room 2', furniture: []},];

test(
  'one room transfer dialog contains two mutually exclusive tabs and preserves both forms',
  () => {
    const html = roomTransferMarkup(rooms, 'r2');
    assert.ok(domElements(html, '[role="tablist"]').length > 0);
    assert.equal(domElements(html, '[role="tab"]').length, 2);
    assert.ok(domElements(html, '[id="warehouse-transfer-tab-export"][aria-selected="true"]').length > 0);
    assert.ok(domElements(html, '[id="warehouse-transfer-panel-import"][hidden]').length > 0);
    assert.ok(domElements(html, '[id="warehouse-transfer-panel-export"]').length > 0);
    assert.ok(domElements(html, '[id="warehouse-room-export-form"]').length > 0);
    assert.ok(domElements(html, '[id="warehouse-room-import-form"]').length > 0);
    assert.ok(domElements(html, '[value="r2"][checked]').length > 0);
    assert.ok(domElements(html, '[id="warehouse-transfer-file"]').length > 0);
    assert.ok(domElements(html, '[id="warehouse-transfer-conflict-policy"]').length > 0);
    assert.ok(domElements(html, '[id="warehouse-transfer-apply"][disabled]').length > 0);
    assert.equal(renderedText(html).includes('warehouse-rooms-export'), false);
    assert.equal(renderedText(html).includes('warehouse-rooms-import'), false);
  }
);

test(
  'import tab is the default for an empty warehouse and export is disabled',
  () => {
    const html = roomTransferMarkup([]);
    assert.ok(domElements(html, '[id="warehouse-transfer-tab-export"][disabled]').length > 0);
    assert.ok(domElements(html, '[id="warehouse-transfer-tab-import"][aria-selected="true"]').length > 0);
    assert.ok(domElements(html, '[id="warehouse-transfer-panel-export"][hidden]').length > 0);
    assert.ok(domElements(html, '[id="warehouse-transfer-panel-import"]').length > 0);
  }
);
