import {renderedText} from '../helpers/rendering.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {roomTransferMarkup}
  from '../../public/js/views/warehouse-room-transfer.js';

const rooms = [{id: 'r1', name: 'Room 1', furniture: [{id: 'f1'}]}, {id: 'r2', name: 'Room 2', furniture: []},];

test(
  'one room transfer dialog contains two mutually exclusive tabs and preserves both forms',
  () => {
    const html = roomTransferMarkup(rooms, 'r2');
    assert.match(renderedText(html), /role="tablist"/);
    assert.equal((renderedText(html).match(/role="tab"/g) || []).length, 2);
    assert.match(renderedText(html), /id="warehouse-transfer-tab-export" aria-selected="true"/);
    assert.match(renderedText(html), /id="warehouse-transfer-panel-import"[^>]+hidden/);
    assert.match(renderedText(html), /id="warehouse-transfer-panel-export"[^>]*>/);
    assert.match(renderedText(html), /id="warehouse-room-export-form"/);
    assert.match(renderedText(html), /id="warehouse-room-import-form"/);
    assert.match(renderedText(html), /value="r2" checked/);
    assert.match(renderedText(html), /id="warehouse-transfer-file"/);
    assert.match(renderedText(html), /id="warehouse-transfer-conflict-policy"/);
    assert.match(renderedText(html), /id="warehouse-transfer-apply" disabled/);
    assert.equal(renderedText(html).includes('warehouse-rooms-export'), false);
    assert.equal(renderedText(html).includes('warehouse-rooms-import'), false);
  }
);

test(
  'import tab is the default for an empty warehouse and export is disabled',
  () => {
    const html = roomTransferMarkup([]);
    assert.match(renderedText(html), /id="warehouse-transfer-tab-export"[^>]*disabled/);
    assert.match(renderedText(html), /id="warehouse-transfer-tab-import" aria-selected="true"/);
    assert.match(renderedText(html), /id="warehouse-transfer-panel-export"[^>]+hidden/);
    assert.match(renderedText(html), /id="warehouse-transfer-panel-import"[^>]*>/);
  }
);
