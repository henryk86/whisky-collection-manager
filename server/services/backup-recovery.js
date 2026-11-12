/** Admin-gated, two-step ZIP restoration. Upload -> validate/preview -> explicit apply.
 * The live collection is never touched by an upload or preview.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { authorizeAdmin } from './backups.js';
import { fail } from '../domain/errors.js';
import { validate } from '../domain/validation.js';
import { runExclusive } from '../storage/collection-store.js';
import { ROOT, BACKUP_DIR } from '../storage/paths.js';
import { writeReadableZip, inspectReadableZip } from '../../shared/backup-zip.js';
import { readBackupPassword } from '../../shared/backup-password.js';

const ID = /^[0-9a-f]{8}-[0-9a-f-]{20,50}$/i;
const LIMIT = 2 * 1024 * 1024 * 1024; // streamed to disk, not buffered in memory
const CONTROL = process.env.BACKUP_CONTROL_DIR ? path.resolve(process.env.BACKUP_CONTROL_DIR) : null;
const FOLDERS = ['data', 'images', 'documents'];
function suppliedPassword(req) {
    try { return decodeURIComponent(req.headers['x-backup-zip-password'] || ''); }
    catch { throw fail('Ungültige Passwort-Zeichenkodierung', 400); }
}
function pathFor(id) {
    if (!ID.test(id)) throw fail('Ungültige Wiederherstellungs-ID', 400);
    if (!CONTROL) throw fail('Backup-Verwaltung nicht eingerichtet', 503);
    return path.join(CONTROL, 'imports', id);
}
function validatePreview(dir) {
    let db;
    try { db = validate(JSON.parse(fs.readFileSync(path.join(dir, 'data', 'collection.json'), 'utf8'))); }
    catch { throw fail('ZIP enthält keine gültige Whisky-Sammlung', 400); }
    return {
        bottlings: db.bottlings.length,
        bottles: db.bottlings.reduce((sum, item) => sum + item.bottles.length, 0),
        distilleries: db.distilleries.length
    };
}
function removeOldImports() {
    const base = path.join(CONTROL, 'imports');
    try {
        for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
            if (!entry.isDirectory() || !ID.test(entry.name)) continue;
            const folder = path.join(base, entry.name);
            if (Date.now() - fs.statSync(folder).mtimeMs > 24 * 3600000) fs.rmSync(folder, { recursive: true, force: true });
        }
    } catch { /* no old imports */ }
}
export async function receiveZip(req) {
    authorizeAdmin(req);
    if (!['application/zip', 'application/octet-stream'].includes((req.headers['content-type'] || '').split(';')[0].trim())) {
        throw fail('Bitte eine ZIP-Datei auswählen', 415);
    }
    if (Number(req.headers['content-length'] || 0) > LIMIT) throw fail('ZIP-Upload ist zu groß', 413);
    removeOldImports();
    const id = crypto.randomUUID();
    const dir = pathFor(id);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const archive = path.join(dir, 'uploaded.zip');
    const fd = fs.openSync(archive, 'wx', 0o600);
    let bytes = 0;
    try {
        for await (const chunk of req) {
            bytes += chunk.length;
            if (bytes > LIMIT) throw fail('ZIP-Upload ist zu groß', 413);
            let written = 0;
            while (written < chunk.length) written += fs.writeSync(fd, chunk, written, chunk.length - written);
        }
    } catch (error) {
        fs.closeSync(fd);
        fs.rmSync(dir, { recursive: true, force: true });
        throw error;
    }
    fs.closeSync(fd);
    try {
        const zip = inspectReadableZip(archive, path.join(dir, 'preview'), suppliedPassword(req));
        const summary = validatePreview(path.join(dir, 'preview'));
        return { id, ...summary, files: zip.files, bytes: zip.bytes,
            message: 'ZIP geprüft. Die laufende Sammlung wurde noch nicht verändert.' };
    } catch (error) {
        fs.rmSync(dir, { recursive: true, force: true });
        if (error.status) throw error;
        throw fail(`ZIP konnte nicht geprüft werden: ${error.message}`, 400);
    }
}
export async function applyZip(req, id, input) {
    authorizeAdmin(req);
    if (input?.acknowledge !== true) throw fail('Wiederherstellung muss ausdrücklich bestätigt werden', 400);
    const dir = pathFor(id);
    const preview = path.join(dir, 'preview');
    if (!fs.existsSync(path.join(dir, 'uploaded.zip'))) throw fail('Hochgeladene Sicherung nicht gefunden', 404);
    const archive = path.join(dir, 'uploaded.zip');
    // Revalidate before the destructive operation, including the central ZIP CRCs.
    try { inspectReadableZip(archive, null, input?.password || ''); } catch (error) { throw fail(`ZIP-Prüfung fehlgeschlagen: ${error.message}`, 400); }
    const summary = validatePreview(preview);
    return runExclusive(() => {
        const fresh = path.join(ROOT, `.restore-new-${id}`);
        const parked = path.join(ROOT, `.restore-old-${id}`);
        fs.mkdirSync(fresh, { recursive: false, mode: 0o700 });
        fs.mkdirSync(parked, { recursive: false, mode: 0o700 });
        const saved = [];
        const moved = [];
        let finished = false;
        try {
            for (const name of FOLDERS) {
                const source = path.join(preview, name);
                const target = path.join(fresh, name);
                if (fs.existsSync(source)) fs.cpSync(source, target, { recursive: true, dereference: false });
                else fs.mkdirSync(target);
            }
            validatePreview(fresh);
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
            const safetyName = `pre-restore-${id}.zip`;
            const safetyPath = path.join(BACKUP_DIR, safetyName);
            const zipPassword = readBackupPassword();
            writeReadableZip(ROOT, safetyPath, zipPassword);
            inspectReadableZip(safetyPath, null, zipPassword);
            for (const name of FOLDERS) {
                const live = path.join(ROOT, name);
                if (fs.existsSync(live)) {
                    fs.renameSync(live, path.join(parked, name));
                    saved.push(name);
                }
                fs.renameSync(path.join(fresh, name), live);
                moved.push(name);
            }
            finished = true;
            fs.rmSync(dir, { recursive: true, force: true });
            return { applied: true, ...summary, safetyBackup: path.join('backups', safetyName),
                message: 'Sicherung übernommen. Vorherige Sammlung als Sicherheits-ZIP gespeichert.' };
        } catch (error) {
            // Roll back even if only part of the three directories was swapped.
            for (const name of [...moved].reverse()) {
                fs.rmSync(path.join(ROOT, name), { recursive: true, force: true });
            }
            for (const name of [...saved].reverse()) {
                if (fs.existsSync(path.join(parked, name))) fs.renameSync(path.join(parked, name), path.join(ROOT, name));
            }
            throw error;
        } finally {
            if (finished) fs.rmSync(parked, { recursive: true, force: true });
            fs.rmSync(fresh, { recursive: true, force: true });
            if (!finished && fs.existsSync(parked) && fs.readdirSync(parked).length === 0) fs.rmSync(parked, { recursive: true, force: true });
        }
    });
}

/** Preview a previously uploaded ZIP or a saved archive prepared by the worker. */
export function previewZip(req, id) {
    authorizeAdmin(req);
    const dir = pathFor(id);
    const archive = path.join(dir, 'uploaded.zip');
    const preview = path.join(dir, 'preview');
    if (!fs.existsSync(archive) || !fs.existsSync(preview)) throw fail('Sicherung nicht gefunden', 404);
    const result = inspectReadableZip(archive, null, suppliedPassword(req));
    return { id, ...result, ...validatePreview(preview) };
}

/** Explicit password check after a worker has staged a saved archive; no passwords in job JSON. */
export function unlockPreparedZip(req, id, input) {
    authorizeAdmin(req);
    const dir = pathFor(id);
    const archive = path.join(dir, 'uploaded.zip');
    if (!fs.existsSync(archive)) throw fail('Vorbereitete Sicherung nicht gefunden', 404);
    const preview = path.join(dir, 'preview');
    fs.rmSync(preview, { recursive: true, force: true });
    try {
        const zip = inspectReadableZip(archive, preview, input?.password || '');
        return { id, ...zip, ...validatePreview(preview) };
    } catch (error) { throw fail(`ZIP konnte nicht geprüft werden: ${error.message}`, 400); }
}
/** Allows an existing Restic snapshot, converted by the worker, to be saved as a portable ZIP. */
export function downloadPreparedZip(req, id) {
    authorizeAdmin(req);
    const dir = pathFor(id);
    const filename = path.join(dir, 'uploaded.zip');
    if (!fs.existsSync(filename) || !fs.lstatSync(filename).isFile()) throw fail('Vorbereitete Sicherung nicht gefunden', 404);
    return { path: filename, filename: 'whisky-backup-wiederherstellung.zip', type: 'application/zip' };
}
