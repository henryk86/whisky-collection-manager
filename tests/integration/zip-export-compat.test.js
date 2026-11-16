import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { zipFiles } from '../helpers/legacy-zip.js';
import { inspectReadableZip } from '../../shared/backup-zip.js';

test('manual ZIP exports from old releases can be imported through the new browser restore', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisky-export-compat-'));
    try {
        const file = path.join(dir, 'export.zip');
        fs.writeFileSync(file, zipFiles([
            ['data/collection.json', Buffer.from('{"schemaVersion":4}')],
            ['images/bottle.jpg', Buffer.from('jpg')],
            ['documents/invoice.pdf', Buffer.from('pdf')],
        ]));
        const extracted = path.join(dir, 'extracted');
        assert.equal(inspectReadableZip(file, extracted).files, 3);
        assert.equal(fs.readFileSync(path.join(extracted, 'images/bottle.jpg'), 'utf8'), 'jpg');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
