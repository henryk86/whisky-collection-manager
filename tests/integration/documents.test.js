import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {startTestServer, requestJson} from '../helpers/server.js';

const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
const image = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
/**
 * Produces the data url text used by the caller.
 *
 * @param {*} bytes Value used by this operation.
 * @param {*} mime Value used by this operation.
 * @return {string} Data URL containing the supplied MIME type and base64 bytes.
 */
const dataUrl = (bytes, mime) => `data:${mime};base64,${bytes.toString('base64')}`;

test(
  'files: invoices and additional images belong to physical bottles, survive export and download securely',
  async () => {
    const ctx = await startTestServer();
    try {
      const created = await requestJson(ctx.base, '/api/bottlings', 'POST', {
        name: 'Insurance archive',
        firstBottle: {
          inventoryNumber: '000555', volumeType: 'sample',
          volumeMl: 30,
        },
      });
      assert.equal(created.status, 201);
      const {bottle, bottling} = created.data;
      const receipt = await requestJson(
        ctx.base,
        `/api/bottles/${bottle.id}/files`,
        'POST',
        {
          filename: 'Rechnung-Österreich.pdf',
          data: dataUrl(pdf, 'application/pdf'),
        }
      );
      assert.equal(receipt.status, 201, JSON.stringify(receipt.data));
      assert.match(receipt.data.path, new RegExp(`^documents/${bottle.id}/[0-9a-f-]+\\.pdf$`));
      assert.equal(receipt.data.name, 'Rechnung-Österreich.pdf');
      assert.equal(receipt.data.sha256, crypto.createHash('sha256').update(pdf).digest('hex'));
      const photoEvidence = await requestJson(
        ctx.base,
        `/api/bottles/${bottle.id}/files`,
        'POST',
        {
          filename: 'Siegel.png', data: dataUrl(image, 'image/png'),
        }
      );
      assert.equal(photoEvidence.status, 201);
      const sibling = await requestJson(ctx.base, '/api/bottles', 'POST', {
        bottlingId: bottling.id,
        inventoryNumber: '000556',
        volumeType: 'standard',
      });
      assert.equal(sibling.status, 201);
      const current = (await requestJson(ctx.base, '/api/collection')).data;
      assert.equal(current.schemaVersion, 6);
      assert.equal(current.bottlings[0].bottles[0].files.length, 2);
      assert.deepEqual(current.bottlings[0].bottles[1].files, []);
      assert.ok(!Object.hasOwn(current.bottlings[0], 'files'));
      assert.equal(current.bottlings[0].bottles[0].volumeType, 'sample');
      const endpoint = `/api/bottles/${bottle.id}/files/${receipt.data.id}`;
      assert.equal(receipt.data.purchaseEvidence, undefined);
      const marked = await requestJson(ctx.base, endpoint, 'PATCH', {purchaseEvidence: true});
      assert.equal(marked.status, 200);
      assert.equal(marked.data.purchaseEvidence, true);
      assert.equal(marked.data.sha256, receipt.data.sha256);
      assert.equal((await requestJson(ctx.base, `/api/bottles/${sibling.data.id}/files/${receipt.data.id}`, 'PATCH', {purchaseEvidence: true})).status, 404);
      assert.equal((await requestJson(ctx.base, endpoint, 'PATCH', {purchaseEvidence: 'true'})).status, 400);
      const persisted = (await requestJson(ctx.base, '/api/collection')).data.bottlings[0].bottles[0].files;
      assert.equal(persisted[0].purchaseEvidence, true);
      assert.equal(persisted[1].purchaseEvidence, undefined);
      assert.equal((await requestJson(ctx.base, endpoint, 'PATCH', {purchaseEvidence: false})).data.purchaseEvidence, false);
      assert.equal((await requestJson(ctx.base, endpoint, 'PATCH', {purchaseEvidence: true})).data.purchaseEvidence, true);
      const downloaded = await fetch(`${ctx.base}/api/bottles/${bottle.id}/files/${receipt.data.id}`);
      assert.equal(downloaded.status, 200);
      assert.match(downloaded.headers.get('content-disposition'), /filename\*=UTF-8''Rechnung-/);
      assert.equal(downloaded.headers.get('content-type'), 'application/octet-stream');
      assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), pdf);
      const preview = await fetch(`${ctx.base}/api/bottles/${bottle.id}/files/${receipt.data.id}/preview`);
      assert.equal(preview.status, 200);
      assert.equal(preview.headers.get('content-type'), 'application/pdf');
      assert.match(preview.headers.get('content-disposition') || '', /^inline; /);
      assert.equal(preview.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(preview.headers.get('cache-control'), 'no-store');
      assert.deepEqual(Buffer.from(await preview.arrayBuffer()), pdf);
      assert.equal(
        (await fetch(`${ctx.base}/api/bottles/${bottle.id}/files/${photoEvidence.data.id}/preview`)).status,
        415,
        'non-PDF attachments must never render inline'
      );
      assert.equal(
        (await fetch(`${ctx.base}/api/bottles/${sibling.data.id}/files/${receipt.data.id}/preview`)).status,
        404,
        'PDF preview must enforce attachment ownership'
      );
      assert.equal((await fetch(`${ctx.base}/api/bottles/${sibling.data.id}/files/${receipt.data.id}`)).status, 404);
      assert.equal(
        (await fetch(`${ctx.base}/${receipt.data.path}`)).status,
        404,
        'documents must not be served by the static file handler'
      );
      const zip = await fetch(`${ctx.base}/api/export/zip`, {headers: {'X-Backup-Admin-Token': 'a'.repeat(64)}});
      assert.equal(zip.status, 200);
      const bytes = Buffer.from(await zip.arrayBuffer());
      assert.ok(bytes.includes(Buffer.from(receipt.data.path)), 'ZIP must contain receipt path');
      assert.ok(bytes.includes(Buffer.from(photoEvidence.data.path)), 'ZIP must contain evidence photo path');
      assert.equal(bytes.includes(pdf), false, 'ZIP must hide original receipt content');
      assert.ok(fs.existsSync(path.join(ctx.dir, receipt.data.path)));
      const remove = await requestJson(ctx.base, `/api/bottles/${bottle.id}/files/${receipt.data.id}`, 'DELETE');
      assert.equal(remove.status, 200);
      assert.equal(fs.existsSync(path.join(ctx.dir, receipt.data.path)), false);
      assert.equal((await fetch(`${ctx.base}/api/bottles/${bottle.id}/files/${receipt.data.id}`)).status, 404);
      assert.equal((await requestJson(ctx.base, '/api/collection')).data.bottlings[0].bottles[0].files.length, 1);
    } finally {await ctx.stop();}
  }
);

test(
  'files: reject incompatible formats, forged headers, traversal, and unknown bottle IDs',
  async () => {
    const ctx = await startTestServer();
    try {
      const created = await requestJson(ctx.base, '/api/bottlings', 'POST', {name: 'Secure uploads'});
      const id = created.data.bottle.id;
      const cases = [
        {filename: '../foo.pdf', data: dataUrl(pdf, 'application/pdf')},
        {filename: 'virus.exe', data: dataUrl(pdf, 'application/pdf')},
        {filename: 'wrong.pdf', data: dataUrl(image, 'application/pdf')},
        {filename: 'invalid.jpg', data: dataUrl(pdf, 'image/jpeg')},
        {filename: 'nonsense.pdf', data: 'not base64'},
        {
          filename: 'empty.pdf',
          data: dataUrl(Buffer.alloc(0), 'application/pdf'),
        },
      ];
      for (const item of cases) {
        const response = await requestJson(ctx.base, `/api/bottles/${id}/files`, 'POST', item);
        assert.ok([400, 413].includes(response.status), `${item.filename}: ${JSON.stringify(response)}`);
      }
      const invalid = await requestJson(
        ctx.base,
        '/api/bottles/missing/files',
        'POST',
        {filename: 'invoice.pdf', data: dataUrl(pdf, 'application/pdf')}
      );
      assert.equal(invalid.status, 404);
      assert.equal((await requestJson(ctx.base, '/api/collection')).data.bottlings[0].bottles[0].files.length, 0);
    } finally {await ctx.stop();}
  }
);

test(
  'schema 3 JSON import upgrades samples and preserves physical bottle details',
  async () => {
    const ctx = await startTestServer();
    try {
      const created = await requestJson(ctx.base, '/api/bottlings', 'POST', {
        name: 'Historical sample',
        firstBottle: {
          inventoryNumber: '009009', volumeType: 'sample',
          volumeMl: 30,
        },
      });
      assert.equal(created.status, 201);
      const current = (await requestJson(ctx.base, '/api/collection')).data;
      const old = {...current, schemaVersion: 3};
      // A former bottling-wide sample marker must migrate to a bottle marker.
      old.bottlings[0].volumeType = 'sample';
      delete old.bottlings[0].bottles[0].volumeType;
      const result = await requestJson(ctx.base, '/api/import/json', 'POST', old);
      assert.equal(result.status, 200);
      const after = (await requestJson(ctx.base, '/api/collection')).data;
      assert.equal(after.schemaVersion, 6);
      assert.equal(after.bottlings[0].id, created.data.bottling.id);
      assert.equal(after.bottlings[0].bottles[0].id, created.data.bottle.id);
      assert.equal(after.bottlings[0].bottles[0].inventoryNumber, '009009');
      assert.equal(after.bottlings[0].bottles[0].volumeType, 'sample');
      assert.equal(after.bottlings[0].bottles[0].volumeMl, 30);
      assert.equal(after.bottlings[0].volumeType, undefined);
    } finally {await ctx.stop();}
  }
);
