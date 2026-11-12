/** Standard WinZip AES-256 (AE-2) ZIP32 backups, with streamed processing.
 * One writer for manual, scheduled, legacy-conversion and safety backups.
 * Legacy unencrypted ZIPs remain readable for migration but cannot be created.
 * File names remain visible (ZIP AES encrypts contents, not archive metadata).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const BLOCK = 128 * 1024;
const MAX32 = 0xffffffff;
const OVERHEAD = 16 + 2 + 10; // salt + verifier + HMAC-SHA1/10
const AES_EXTRA = Buffer.from([0x01, 0x99, 0x07, 0x00, 0x02, 0x00, 0x41, 0x45, 0x03, 0x00, 0x00]);
const TABLE = Array.from({ length: 256 }, (_, start) => {
    let value = start;
    for (let i = 0; i < 8; i++) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    return value >>> 0;
});
function crc32(buffer, previous = 0xffffffff) {
    let value = previous;
    for (const byte of buffer) value = TABLE[(value ^ byte) & 255] ^ (value >>> 8);
    return value >>> 0;
}
function write(fd, buffer) {
    let position = 0;
    while (position < buffer.length) position += fs.writeSync(fd, buffer, position, buffer.length - position);
}
function fileContent(file, callback) {
    const fd = fs.openSync(file, 'r');
    try {
        const buffer = Buffer.allocUnsafe(BLOCK);
        let count;
        while ((count = fs.readSync(fd, buffer, 0, BLOCK, null)) > 0) callback(buffer.subarray(0, count));
    } finally { fs.closeSync(fd); }
}
function safeName(name) {
    return typeof name === 'string' && name.length <= 1024 && !name.includes('\\') && !name.includes('\0') &&
        !name.startsWith('/') && !name.endsWith('/') &&
        name.split('/').every(part => part && part !== '.' && part !== '..') &&
        (name === 'README.txt' || /^(data|images|documents)\/.+/.test(name));
}
function walk(root, relative) {
    const files = [];
    const visit = (name) => {
        const absolute = path.join(root, name);
        for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
            if (entry.isSymbolicLink()) throw Error('Sicherungsquelle enthält einen symbolischen Link. Sicherung abgebrochen.');
            const child = `${name}/${entry.name}`;
            if (!safeName(child)) throw Error('Ungültiger Dateiname in der Sicherung');
            if (entry.isDirectory()) visit(child);
            else if (entry.isFile()) files.push({ name: child, source: path.join(root, child) });
            else throw Error('Unbekannter Dateityp in der Sicherung');
        }
    };
    for (const folder of relative) if (fs.existsSync(path.join(root, folder))) visit(folder);
    if (!files.some(f => f.name === 'data/collection.json')) throw Error('Sammlung fehlt in Sicherungsquelle');
    return files.sort((a, b) => a.name.localeCompare(b.name));
}
function requiredPassword(password) {
    if (typeof password !== 'string' || password.length < 14) {
        throw Error('ZIP-Passwort fehlt oder ist zu kurz. In der Backup-Verwaltung mindestens 14 Zeichen festlegen.');
    }
    return password;
}
function aes(password, salt) {
    const keys = crypto.pbkdf2Sync(Buffer.from(password, 'utf8'), salt, 1000, 66, 'sha1');
    const cipher = crypto.createCipheriv('aes-256-ecb', keys.subarray(0, 32), null);
    cipher.setAutoPadding(false);
    const mac = crypto.createHmac('sha1', keys.subarray(32, 64));
    const verifier = keys.subarray(64, 66);
    const counter = Buffer.alloc(16);
    let unused = Buffer.alloc(0);
    const xor = data => {
        const output = Buffer.allocUnsafe(data.length);
        let index = 0;
        if (unused.length) {
            const n = Math.min(unused.length, data.length);
            for (let j = 0; j < n; j++) output[j] = data[j] ^ unused[j];
            unused = unused.subarray(n);
            index = n;
        }
        if (index < data.length) {
            // Encrypt all CTR counters in one native AES call per streamed chunk.
            const count = Math.ceil((data.length - index) / 16);
            const counters = Buffer.allocUnsafe(count * 16);
            for (let b = 0; b < count; b++) {
                // WinZip AES uses a little-endian counter starting at 1.
                for (let i = 0; i < 16; i++) { counter[i]++; if (counter[i] !== 0) break; }
                counter.copy(counters, b * 16);
            }
            const stream = cipher.update(counters);
            const needed = data.length - index;
            for (let j = 0; j < needed; j++) output[index + j] = data[index + j] ^ stream[j];
            unused = stream.subarray(needed);
        }
        return output;
    };
    return { verifier, mac, xor };
}
function aesExtra(extra) {
    let offset = 0;
    while (offset + 4 <= extra.length) {
        const key = extra.readUInt16LE(offset), size = extra.readUInt16LE(offset + 2);
        if (offset + 4 + size > extra.length) throw Error('Ungültiges ZIP-Zusatzfeld');
        if (key === 0x9901) {
            const field = extra.subarray(offset + 4, offset + 4 + size);
            if (size !== 7 || field.readUInt16LE(0) !== 2 || field.toString('ascii', 2, 4) !== 'AE' ||
                field[4] !== 3 || field.readUInt16LE(5) !== 0) throw Error('Nicht unterstützte ZIP-Verschlüsselung');
            return true;
        }
        offset += 4 + size;
    }
    return false;
}
/** Requires a password. No plaintext ZIP can be produced by this writer. */
export function writeReadableZip(sourceRoot, destination, password, timestamp = new Date().toISOString()) {
    requiredPassword(password);
    const files = walk(sourceRoot, ['data', 'images', 'documents']);
    files.unshift({ name: 'README.txt', contents: Buffer.from(
        `WhiskyCollectionManager - passwortgeschuetzte Sicherung (AES-256)\nErstellt: ${timestamp}\n\n` +
        'data/collection.json: Sammlung (JSON)\ndata/warehouse.json: Lagerverwaltung (JSON, falls vorhanden)\nimages/: Bilder\ndocuments/: Dokumente\n' +
        'Zum Oeffnen 7-Zip oder ein anderes WinZip-AES-256-kompatibles Programm verwenden.\n' +
        'Ohne das Backup-Passwort lassen sich die Dateien nicht entschluesseln.\n', 'utf8') });
    const fd = fs.openSync(destination, 'wx', 0o600);
    let offset = 0;
    const central = [];
    try {
        for (const entry of files) {
            const name = Buffer.from(entry.name, 'utf8');
            if (name.length > 65535) throw Error('Dateiname zu lang');
            const stat = entry.source ? fs.lstatSync(entry.source) : { size: entry.contents.length };
            if (entry.source && !stat.isFile()) throw Error('Backup-Quelle hat sich verändert');
            const size = stat.size, encryptedSize = size + OVERHEAD;
            const localSize = 30 + name.length + AES_EXTRA.length;
            if (encryptedSize > MAX32 || offset + encryptedSize + localSize > MAX32) {
                throw Error('ZIP-Backup größer als 4 GiB. Das aktuelle ZIP32-Format unterstützt diese Größe nicht.');
            }
            const header = Buffer.alloc(30);
            header.writeUInt32LE(0x04034b50, 0);
            header.writeUInt16LE(51, 4); // ZIP AES version needed to extract
            header.writeUInt16LE(0x0801, 6); // UTF-8 and encrypted
            header.writeUInt16LE(99, 8); // WinZip AES marker
            header.writeUInt32LE(0, 14); // AE-2 CRC must be zero
            header.writeUInt32LE(encryptedSize, 18);
            header.writeUInt32LE(size, 22);
            header.writeUInt16LE(name.length, 26);
            header.writeUInt16LE(AES_EXTRA.length, 28);
            write(fd, header); write(fd, name); write(fd, AES_EXTRA);
            const salt = crypto.randomBytes(16), context = aes(password, salt);
            write(fd, salt); write(fd, context.verifier);
            const encrypt = data => {
                const ciphertext = context.xor(data);
                context.mac.update(ciphertext);
                write(fd, ciphertext);
            };
            if (entry.source) fileContent(entry.source, encrypt);
            else encrypt(entry.contents);
            write(fd, context.mac.digest().subarray(0, 10));
            const center = Buffer.alloc(46);
            center.writeUInt32LE(0x02014b50, 0);
            center.writeUInt16LE(51, 4);
            center.writeUInt16LE(51, 6);
            center.writeUInt16LE(0x0801, 8);
            center.writeUInt16LE(99, 10);
            center.writeUInt32LE(0, 16);
            center.writeUInt32LE(encryptedSize, 20);
            center.writeUInt32LE(size, 24);
            center.writeUInt16LE(name.length, 28);
            center.writeUInt16LE(AES_EXTRA.length, 30);
            center.writeUInt32LE(offset, 42);
            central.push(center, name, AES_EXTRA);
            offset += localSize + encryptedSize;
        }
        const directorySize = central.reduce((sum, item) => sum + item.length, 0);
        if (files.length > 65535 || offset + directorySize + 22 > MAX32) throw Error('ZIP-Archiv zu groß');
        for (const chunk of central) write(fd, chunk);
        const end = Buffer.alloc(22);
        end.writeUInt32LE(0x06054b50, 0);
        end.writeUInt16LE(files.length, 8);
        end.writeUInt16LE(files.length, 10);
        end.writeUInt32LE(directorySize, 12);
        end.writeUInt32LE(offset, 16);
        write(fd, end);
        fs.fsyncSync(fd);
        return { files: files.length, bytes: offset + directorySize + 22, encrypted: true };
    } catch (error) {
        fs.rmSync(destination, { force: true });
        throw error;
    } finally { fs.closeSync(fd); }
}
function readAt(fd, length, offset) {
    const buffer = Buffer.alloc(length);
    if (fs.readSync(fd, buffer, 0, length, offset) !== length) throw Error('Unvollständiges ZIP-Archiv');
    return buffer;
}
/** Authenticates all AES-256 entries before accepting a backup. Supports old plain ZIPs for restore. */
export function inspectReadableZip(archive, extractTo = null, password = '') {
    const fd = fs.openSync(archive, 'r');
    const entries = [], seen = new Set();
    let extracted = false, encrypted = false;
    try {
        const fileSize = fs.fstatSync(fd).size;
        if (fileSize < 22) throw Error('Unvollständiges ZIP');
        const end = readAt(fd, 22, fileSize - 22);
        if (end.readUInt32LE(0) !== 0x06054b50 || end.readUInt16LE(20) !== 0) throw Error('ZIP-Ende fehlt');
        const count = end.readUInt16LE(10);
        const centralSize = end.readUInt32LE(12), centralOffset = end.readUInt32LE(16);
        if (count > 20000 || centralOffset + centralSize !== fileSize - 22) throw Error('ZIP-Verzeichnis ungültig');
        let offset = centralOffset, totalSize = 0;
        for (let i = 0; i < count; i++) {
            const head = readAt(fd, 46, offset);
            if (head.readUInt32LE(0) !== 0x02014b50) throw Error('ZIP-Eintrag ungültig');
            const flags = head.readUInt16LE(8), method = head.readUInt16LE(10);
            const isAes = flags === 0x0801 && method === 99;
            if (!isAes && (![0, 0x0800].includes(flags) || method !== 0)) throw Error('Nicht unterstützte ZIP-Verschlüsselung oder Kompression');
            const length = head.readUInt16LE(28), extraLen = head.readUInt16LE(30), comment = head.readUInt16LE(32);
            const name = readAt(fd, length, offset + 46).toString('utf8');
            const extra = readAt(fd, extraLen, offset + 46 + length);
            if (isAes !== aesExtra(extra)) throw Error('ZIP-AES-Feld fehlt oder ist ungültig');
            const size = head.readUInt32LE(24), compressed = head.readUInt32LE(20), crc = head.readUInt32LE(16);
            if (!safeName(name) || seen.has(name)) throw Error('Unsicherer oder doppelter ZIP-Dateiname');
            if (isAes && (compressed !== size + OVERHEAD || crc !== 0)) throw Error('ZIP-AES-Größe ungültig');
            if (!isAes && compressed !== size) throw Error('ZIP-Größe ungültig');
            seen.add(name);
            totalSize += size;
            if (totalSize > 16 * 1024 * 1024 * 1024) throw Error('ZIP zu groß für die Prüfung');
            const localOffset = head.readUInt32LE(42);
            if (localOffset + 30 + length + extraLen + compressed > centralOffset) throw Error('ZIP-Datenbereich ungültig');
            const local = readAt(fd, 30, localOffset);
            if (local.readUInt32LE(0) !== 0x04034b50 || local.readUInt16LE(6) !== flags ||
                local.readUInt16LE(8) !== method || local.readUInt16LE(26) !== length ||
                local.readUInt32LE(14) !== crc || local.readUInt32LE(18) !== compressed ||
                local.readUInt32LE(22) !== size || local.readUInt16LE(28) !== extraLen) throw Error('ZIP-Kopf stimmt nicht überein');
            const localName = readAt(fd, length, localOffset + 30).toString('utf8');
            const localExtra = readAt(fd, extraLen, localOffset + 30 + length);
            if (localName !== name || isAes !== aesExtra(localExtra)) throw Error('ZIP-Dateiname oder AES-Feld ungültig');
            const start = localOffset + 30 + length + extraLen;
            entries.push({ name, size, crc, start, isAes });
            encrypted ||= isAes;
            offset += 46 + length + extraLen + comment;
        }
        if (offset !== centralOffset + centralSize || !seen.has('data/collection.json')) throw Error('ZIP-Verzeichnis unvollständig');
        if (extractTo) fs.mkdirSync(extractTo, { recursive: true, mode: 0o700 });
        for (const entry of entries) {
            let current = 0xffffffff, remaining = entry.size, position = entry.start, context;
            if (entry.isAes) {
                if (!password) throw Error('ZIP ist mit AES-256 geschützt. Bitte das Backup-Passwort eingeben.');
                const salt = readAt(fd, 16, position);
                const verifier = readAt(fd, 2, position + 16);
                context = aes(password, salt);
                if (!crypto.timingSafeEqual(verifier, context.verifier)) throw Error('Backup-Passwort falsch.');
                position += 18;
            }
            const destination = extractTo && path.join(extractTo, entry.name);
            let out;
            if (destination) {
                fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
                out = fs.openSync(destination, 'wx', 0o600);
            }
            try {
                while (remaining) {
                    const bytes = Math.min(BLOCK, remaining);
                    const chunk = readAt(fd, bytes, position);
                    const plain = entry.isAes ? (context.mac.update(chunk), context.xor(chunk)) : chunk;
                    if (!entry.isAes) current = crc32(plain, current);
                    if (out !== undefined) write(out, plain);
                    position += bytes; remaining -= bytes;
                }
            } finally { if (out !== undefined) fs.closeSync(out); }
            if (entry.isAes) {
                const expected = readAt(fd, 10, position), actual = context.mac.digest().subarray(0, 10);
                if (!crypto.timingSafeEqual(actual, expected)) throw Error(`ZIP-Authentifizierung fehlgeschlagen: ${entry.name}`);
            } else if (((current ^ 0xffffffff) >>> 0) !== entry.crc) throw Error(`ZIP-Prüfsumme ungültig: ${entry.name}`);
        }
        if (extractTo) {
            JSON.parse(fs.readFileSync(path.join(extractTo, 'data/collection.json'), 'utf8'));
            extracted = true;
        }
        return { files: entries.length, bytes: fileSize, encrypted };
    } finally {
        fs.closeSync(fd);
        if (extractTo && !extracted) fs.rmSync(extractTo, { recursive: true, force: true });
    }
}
