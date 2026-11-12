/** Binary attachments belong to physical bottles, never to a bottling. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DOCUMENT_DIR, ROOT } from './paths.js';
import { assert, fail } from '../domain/errors.js';

// Whitelist file types used for invoices, photographs, and supporting records.
const fileTypes = {
    pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    heic: 'image/heic', heif: 'image/heif',
    txt: 'text/plain', csv: 'text/csv', eml: 'message/rfc822',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    odt: 'application/vnd.oasis.opendocument.text',
    ods: 'application/vnd.oasis.opendocument.spreadsheet'
};
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;

export function isDocumentPath(value, bottleId) {
    if (typeof value !== 'string' || !/^documents\/[\w-]+\/[a-f0-9-]{36}\.[a-z0-9]+$/i.test(value)) {
        return false;
    }
    if (bottleId != null && !value.startsWith(`documents/${bottleId}/`)) {
        return false;
    }
    return Object.hasOwn(fileTypes, path.extname(value).slice(1).toLowerCase());
}
function isValidContent(extension, bytes) {
    if (extension === 'pdf') return bytes.subarray(0, 5).toString('ascii') === '%PDF-';
    if (extension === 'jpg' || extension === 'jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (extension === 'png') return bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
    if (extension === 'webp') return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    if (extension === 'gif') return ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6));
    if (extension === 'heic' || extension === 'heif') {
        return bytes.length >= 12 && bytes.toString('ascii', 4, 8) === 'ftyp' && /^(hei[cfmx]|mif1|msf1)$/.test(bytes.toString('ascii', 8, 12));
    }
    if (['docx', 'xlsx', 'odt', 'ods'].includes(extension)) {
        return bytes.subarray(0, 4).equals(Buffer.from('504b0304', 'hex'));
    }
    if (['txt', 'csv', 'eml'].includes(extension)) {
        if (bytes.includes(0)) return false;
        try {
            new TextDecoder('utf-8', { fatal: true }).decode(bytes);
            return true;
        }
        catch { return false; }
    }
    return false;
}
function fileLocation(relativePath) {
    assert(isDocumentPath(relativePath), 'Ungueltiger Dokumentpfad');
    const absolute = path.resolve(ROOT, relativePath);
    assert(absolute.startsWith(DOCUMENT_DIR + path.sep), 'Ungueltiger Dokumentpfad');
    return absolute;
}
/** Save by random ID rather than user supplied filename; the original name is metadata. */
export function saveDocument(bottleId, { filename, data }) {
    assert(typeof bottleId === 'string' && /^[\w-]{1,128}$/.test(bottleId), 'Ungueltige Flaschen-ID');
    assert(typeof filename === 'string' && filename.length > 0 && filename.length <= 180
        && !/[\\/\x00-\x1f\x7f]/.test(filename) && filename.trim() === filename, 'Ungueltiger Dateiname');
    const ext = path.extname(filename).slice(1).toLowerCase();
    assert(Object.hasOwn(fileTypes, ext), 'Dateityp nicht unterstuetzt');
    assert(typeof data === 'string' && data.length < MAX_DOCUMENT_BYTES * 4 / 3 + 1024, 'Datei zu gross (max. 15 MB)', 413);
    const match = /^data:[^;,]*;base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
    assert(match, 'Ungueltige Dateiuebertragung');
    const bytes = Buffer.from(match[1], 'base64');
    assert(bytes.length > 0 && bytes.length <= MAX_DOCUMENT_BYTES, 'Datei leer oder groesser als 15 MB', 413);
    assert(isValidContent(ext, bytes), 'Dateiinhalt passt nicht zum Dateityp');
    const documentId = crypto.randomUUID();
    const relativePath = `documents/${bottleId}/${documentId}.${ext}`;
    const target = fileLocation(relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes, { flag: 'wx', mode: 0o600 });
    return {
        id: documentId, name: filename, path: relativePath, size: bytes.length,
        mimeType: fileTypes[ext], sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
        uploadedAt: new Date().toISOString()
    };
}
export function readDocument(relativePath) {
    const file = fileLocation(relativePath);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        throw fail('Datei auf dem Server nicht gefunden', 404);
    }
    return fs.readFileSync(file);
}
export function deleteDocument(relativePath) {
    const file = fileLocation(relativePath);
    if (fs.existsSync(file)) {
        fs.unlinkSync(file);
    }
}
