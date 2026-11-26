import test from 'node:test';
import assert from 'node:assert/strict';
import {insuranceInventory} from '../../public/js/domain/insurance.js';
import {EvidenceArchive, crc32} from '../../public/js/features/insurance/archive.js';
import {ImagePdf, wrapReportText} from '../../public/js/features/insurance/pdf.js';

const bottle = (id, overrides = {}) => ({id, inventoryNumber: id, volumeType: 'standard', status: 'closed', purchasePrice: 10, currency: 'EUR', purchaseDate: '2026-01-01', ...overrides});

test('insurance: only current stock, personal photos, designated evidence and known currency count', () => {
  const collection = {
    bottlings: [{
      id: 'release', name: 'Whisky', bottles: [
        bottle('001', {photos: [{path: 'own.jpg'}], files: [{purchaseEvidence: true}]}),
        bottle('002', {status: 'open', purchasePrice: null, photos: [{path: 'catalog.jpg', source: 'whiskybase'}], files: [{name: 'invoice.pdf'}]}),
        bottle('003', {purchasePrice: 0, currency: 'GBP'}),
        bottle('004', {status: 'empty'}),
        bottle('005', {volumeType: 'sample'}),
        bottle('006', {currency: ''}),
      ],
    }],
  };
  const warehouse = {rooms: [{name: 'Room', furniture: [{name: 'Cabinet', shelves: [{id: 'shelf', name: 'Shelf'}]}]}], assignments: {'001': 'shelf', '002': 'missing'}};
  const snapshot = structuredClone(collection);
  const data = insuranceInventory(collection, warehouse);
  assert.deepEqual(data.rows.map(row => row.bottle.id), ['001', '002', '003', '006']);
  assert.equal(data.complete, 1);
  assert.equal(data.open, 1);
  assert.equal(data.closed, 3);
  assert.deepEqual(data.totals, [['EUR', 10], ['GBP', 0]]);
  assert.deepEqual(data.rows[1].checks, {number: true, price: false, date: true, photo: false, receipt: false, location: false});
  assert.equal(data.rows[0].place.label, 'Room / Cabinet / Shelf');
  assert.equal(insuranceInventory(collection, warehouse, true).rows.length, 5);
  assert.deepEqual(collection, snapshot);
  assert.equal(insuranceInventory(null, null).rows.length, 0);
});

test('insurance ZIP preserves original bytes, CRC, UTF-8 names and central directory offsets', async () => {
  const original = new Uint8Array([0, 1, 2, 255, 0]);
  const name = 'documents/abc/Beleg-ä.pdf';
  const archive = new EvidenceArchive();
  await archive.add(name, new Blob([original]));
  await assert.rejects(archive.add(name, new Blob([])));
  await assert.rejects(archive.add('../private', new Blob([])));
  const bytes = new Uint8Array(await archive.finish().arrayBuffer());
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(14, true), crc32(original));
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const length = view.getUint16(26, true);
  assert.equal(new TextDecoder().decode(bytes.subarray(30, 30 + length)), name);
  assert.deepEqual(bytes.subarray(30 + length, 30 + length + original.length), original);
  const end = bytes.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  assert.equal(view.getUint16(end + 10, true), 1);
  const central = view.getUint32(end + 16, true);
  assert.equal(view.getUint32(central, true), 0x02014b50);
  assert.equal(view.getUint32(central + 42, true), 0);
});

test('insurance PDF contains each page and byte-accurate cross-reference offsets', async () => {
  const pdf = new ImagePdf();
  pdf.addPage(new Blob([new Uint8Array([255, 216, 255, 217])]), 1240, 1754);
  pdf.addPage(new Blob([new Uint8Array([255, 216, 255, 217])]), 1240, 1754);
  const bytes = Buffer.from(await pdf.finish().arrayBuffer());
  const text = bytes.toString('latin1');
  assert.match(text, /^%PDF-1\.4/);
  assert.match(text, /\/Count 2 /);
  const offset = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(text.slice(offset, offset + 4), 'xref');
  const lines = text.slice(offset).split('\n');
  const count = Number(lines[1].split(' ')[1]);
  for (let id = 1; id < count; id++) {
    const position = Number(lines[id + 2].slice(0, 10));
    assert.equal(text.slice(position, position + `${id} 0 obj`.length), `${id} 0 obj`);
  }
});


test('insurance report wraps at words and retains long unbroken identifiers', () => {
  assert.deepEqual(wrapReportText('Word one word two', 8, value => value.length), ['Word one', 'word two']);
  assert.deepEqual(wrapReportText('A 123456789012345 B', 8, value => value.length), ['A', '12345678', '9012345', 'B']);
});
