/** Backup administration is deliberately separate from collection.json.
 * The web process never receives cloud credentials or restic encryption keys. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fail } from '../domain/errors.js';
import { DATA_DIR, IMAGE_DIR, DOCUMENT_DIR, DATA_FILE } from '../storage/paths.js';
import { hasBackupPassword, saveBackupPassword } from '../../shared/backup-password.js';

const CONTROL = process.env.BACKUP_CONTROL_DIR ? path.resolve(process.env.BACKUP_CONTROL_DIR) : null;
const PROVIDERS = new Set(['local', 'dropbox', 'google-drive', 'onedrive', 'sftp', 's3', 'webdav', 'other']);
const FREQUENCIES = new Set(['hourly', 'daily', 'weekly']);
const FORMATS = new Set(['zip']); // Restic remains readable for legacy profiles only
export const ZIP_FILENAME = /^whisky-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(?:-\d{3})?-[0-9a-f]{8}\.zip$/i;
const ID = /^[0-9a-f]{8}-[0-9a-f-]{20,50}$/i;
const PROFILE_FILE = 'profiles.json';
const STATUS_FILE = 'worker-status.json';
const SAFE_REMOTE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,49}$/;

function secret(name) {
    const file = process.env[`${name}_FILE`];
    if (file) {
        try { return fs.readFileSync(file, 'utf8').trim(); }
        catch { return ''; }
    }
    return String(process.env[name] || '').trim();
}
function secureEqual(actual, provided) {
    if (!actual || actual.length < 24 || !provided || typeof provided !== 'string') return false;
    const expected = crypto.createHash('sha256').update(actual).digest();
    const received = crypto.createHash('sha256').update(provided).digest();
    return crypto.timingSafeEqual(expected, received);
}
function assertConfigured() {
    if (!CONTROL || !secret('BACKUP_ADMIN_TOKEN')) {
        throw fail('Backup-Verwaltung nicht eingerichtet. Siehe docs/DOCKER_BACKUP.md.', 503);
    }
}
export function authorizeAdmin(req) {
    assertConfigured();
    if (!secureEqual(secret('BACKUP_ADMIN_TOKEN'), req.headers['x-backup-admin-token'])) {
        throw fail('Backup-Verwaltung gesperrt: Administrator-Schlüssel erforderlich.', 401);
    }
}
export function authorizeWorker(req) {
    if (!CONTROL || !secureEqual(secret('BACKUP_WORKER_TOKEN'), req.headers['x-backup-worker-token'])) {
        throw fail('Backup-Worker nicht autorisiert.', 403);
    }
}
function readJson(name, fallback) {
    if (!CONTROL) return fallback;
    try { return JSON.parse(fs.readFileSync(path.join(CONTROL, name), 'utf8')); }
    catch (err) {
        if (err.code === 'ENOENT') return fallback;
        throw err;
    }
}
function atomicJson(name, value) {
    fs.mkdirSync(CONTROL, { recursive: true, mode: 0o700 });
    const destination = path.join(CONTROL, name);
    const temp = `${destination}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
        fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
        fs.renameSync(temp, destination);
    } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}
function profiles() {
    const value = readJson(PROFILE_FILE, { version: 1, profiles: [] });
    if (value.version !== 1 || !Array.isArray(value.profiles)) throw Error('Ungültige Backup-Profilkonfiguration');
    return value;
}
function string(value, title, max = 80) {
    if (typeof value !== 'string' || !value.trim() || value.length > max) throw fail(`${title}: ungültiger Wert`);
    return value.trim();
}
function number(value, min, max, label) {
    if (!Number.isInteger(value) || value < min || value > max) throw fail(`${label}: außerhalb des gültigen Bereichs`);
    return value;
}
export function validateRelativePath(value) {
    const text = string(value, 'Zielpfad', 180);
    if (!/^[a-zA-Z0-9 _./-]+$/.test(text) || text.startsWith('/') || text.endsWith('/') || text.includes('\\') || text.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.'))) {
        throw fail('Zielpfad muss relativ sein und darf keine übergeordneten Verzeichnisse enthalten.');
    }
    return text;
}
export function validateProfile(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail('Ungültiges Backup-Profil');
    const provider = string(input.provider, 'Anbieter', 32);
    const format = input.format ?? 'zip';
    if (!FORMATS.has(format)) throw fail('Unbekanntes Backup-Format');
    if (!PROVIDERS.has(provider)) throw fail('Unbekannter Backup-Anbieter');
    const remote = provider === 'local' ? '' : string(input.remote, 'Rclone-Verbindung', 50);
    if (remote && !SAFE_REMOTE.test(remote)) throw fail('Rclone-Verbindung darf nur Buchstaben, Zahlen, - und _ enthalten');
    const frequency = input.schedule?.frequency ?? 'daily';
    if (!FREQUENCIES.has(frequency)) throw fail('Unbekannter Zeitplan');
    const schedule = {
        frequency,
        hour: number(input.schedule?.hour ?? 2, 0, 23, 'Stunde'),
        minute: number(input.schedule?.minute ?? 0, 0, 59, 'Minute'),
        weekday: number(input.schedule?.weekday ?? 0, 0, 6, 'Wochentag')
    };
    const retention = {
        daily: number(input.retention?.daily ?? 7, 0, 366, 'Tägliche Aufbewahrung'),
        weekly: number(input.retention?.weekly ?? 4, 0, 104, 'Wöchentliche Aufbewahrung'),
        monthly: number(input.retention?.monthly ?? 12, 0, 120, 'Monatliche Aufbewahrung'),
    };
    if (Object.values(retention).every(value => !value)) throw fail('Mindestens eine Aufbewahrungsregel erforderlich');
    if (provider === 'local' && validateRelativePath(input.targetPath).split('/').length !== 2) {
        throw fail('Lokales Backup-Ziel muss aus Laufwerk und Ordner bestehen, z. B. usb/whisky-backups');
    }
    const result = {
        name: string(input.name, 'Profilname'), provider, format, remote, targetPath: validateRelativePath(input.targetPath),
        enabled: input.enabled !== false, schedule, retention,
    };
    return result;
}
export function setZipPassword(req, input) {
    authorizeAdmin(req);
    if (typeof input?.password !== 'string' || input.password !== input.confirm) throw fail('Passwörter stimmen nicht überein', 400);
    try { saveBackupPassword(input.password, input.previous); }
    catch (error) { throw fail(error.message, 400); }
    return { passwordConfigured: true, message: 'Backup-Passwort gespeichert. Künftige ZIPs sind AES-256-geschützt.' };
}
export function getDashboard(req) {
    authorizeAdmin(req);
    const status = readJson(STATUS_FILE, { updatedAt: null, jobs: [], snapshots: {}, remotes: [] });
    const lastUpdate = status.updatedAt ? Date.parse(status.updatedAt) : 0;
    const targets = [];
    const root = path.resolve(process.env.BACKUP_TARGET_ROOT || '/backup-targets');
    try {
        for (const dirent of fs.readdirSync(root, { withFileTypes: true })) {
            if (!dirent.isDirectory() || !/^[a-zA-Z0-9_-]{1,50}$/.test(dirent.name)) continue;
            const marker = path.join(root, dirent.name, '.whisky-backup-target');
            if (fs.existsSync(marker) && fs.lstatSync(marker).isFile()) {
                targets.push({ name: dirent.name, label: dirent.name === 'usb' ? 'USB-Stick' : dirent.name });
            }
        }
    } catch { /* optional target path missing */ }
    return {
        profiles: profiles().profiles,
        targets,
        worker: { online: Date.now() - lastUpdate < 120000, updatedAt: status.updatedAt || null },
        jobs: Array.isArray(status.jobs) ? status.jobs.slice(0, 50) : [],
        snapshots: status.snapshots || {},
        remotes: Array.isArray(status.remotes) ? status.remotes : [],
        timeZone: status.timeZone || 'Europe/Berlin',
        passwordConfigured: hasBackupPassword()
    };
}
function assertDistinctTarget(existing, candidate, excludeId = null) {
    const key = item => item.provider === 'local'
        ? `local:${item.targetPath.toLowerCase()}`
        : `rclone:${item.remote.toLowerCase()}:${item.targetPath.toLowerCase()}`;
    if (existing.some(p => p.id !== excludeId && key(p) === key(candidate))) {
        throw fail('Dieses Backup-Ziel wird bereits von einem anderen Profil genutzt. Jedes Profil benötigt ein eigenes Repository.', 409);
    }
}
export function createProfile(req, input) {
    authorizeAdmin(req);
    const data = profiles();
    if (data.profiles.length >= 64) throw fail('Maximal 64 Backup-Profile möglich');
    const now = new Date().toISOString();
    const profile = { ...validateProfile(input), id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    assertDistinctTarget(data.profiles, profile);
    data.profiles.push(profile);
    atomicJson(PROFILE_FILE, data);
    return profile;
}
function findProfile(data, id) {
    if (!ID.test(id)) throw fail('Ungültige Profil-ID', 404);
    const index = data.profiles.findIndex(item => item.id === id);
    if (index < 0) throw fail('Backup-Profil nicht gefunden', 404);
    return index;
}
export function updateProfile(req, id, input) {
    authorizeAdmin(req);
    const data = profiles();
    const index = findProfile(data, id);
    const profile = { ...validateProfile(input), id, createdAt: data.profiles[index].createdAt, updatedAt: new Date().toISOString() };
    if (data.profiles[index].format !== 'zip' && profile.provider === data.profiles[index].provider &&
        profile.remote === data.profiles[index].remote && profile.targetPath === data.profiles[index].targetPath) {
        throw fail('Altes Restic-Repository: Bitte für ZIP-Sicherungen einen neuen Zielordner auswählen. Das alte Backup bleibt erhalten.');
    }
    assertDistinctTarget(data.profiles, profile, id);
    data.profiles[index] = profile;
    atomicJson(PROFILE_FILE, data);
    return profile;
}
export function deleteProfile(req, id) {
    authorizeAdmin(req);
    const data = profiles();
    data.profiles.splice(findProfile(data, id), 1);
    atomicJson(PROFILE_FILE, data);
    // Archives / Restic repositories and snapshots intentionally remain untouched.
    return { deleted: true, repositoryDeleted: false };
}
export function queueJob(req, profileId, type, body = {}) {
    authorizeAdmin(req);
    findProfile(profiles(), profileId);
    if (!['run', 'check', 'test', 'snapshots', 'restore', 'prepare'].includes(type)) throw fail('Unbekannter Backup-Auftrag');
    const item = profiles().profiles.find(p => p.id === profileId);
    if (item.format !== 'zip' && type === 'run') throw fail('Dieses Altprofil verwendet Restic. Für neue Sicherungen bitte auf ZIP umstellen.', 409);
    if (item.format === 'zip' && type === 'restore') throw fail('ZIP-Sicherungen über die Vorschau einspielen.', 409);
    const job = { id: crypto.randomUUID(), profileId, type, createdAt: new Date().toISOString() };
    if (type === 'restore' || type === 'prepare') {
        const isZip = item.format === 'zip';
        if (!(isZip ? body?.snapshotId === 'latest' || ZIP_FILENAME.test(body?.snapshotId || '')
            : /^(latest|[0-9a-f]{8,64})$/i.test(body?.snapshotId || ''))) throw fail('Ungültige Sicherungs-ID');
        job.snapshotId = body.snapshotId;
    }
    const dir = path.join(CONTROL, 'jobs');
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const temp = path.join(dir, `.${job.id}.tmp`);
    fs.writeFileSync(temp, JSON.stringify(job) + '\n', { flag: 'wx', mode: 0o600 });
    fs.renameSync(temp, path.join(dir, `${job.id}.json`));
    return { ...job, queued: true };
}

/** Only the worker can request a synchronous, consistent source snapshot.
 * Node's event loop processes no app writes while these copies are in progress. */
export function createSourceSnapshot(req, jobId) {
    authorizeWorker(req);
    if (!ID.test(jobId)) throw fail('Ungültige Backup-Auftrags-ID');
    const stagingRoot = path.join(CONTROL, 'staging');
    fs.mkdirSync(stagingRoot, { recursive: true, mode: 0o700 });
    const folder = path.join(stagingRoot, jobId);
    // Reuse an already frozen snapshot when a worker was interrupted mid-job.
    if (fs.existsSync(folder)) {
        if (fs.existsSync(path.join(folder, 'data/collection.json'))) return { jobId, created: false };
        throw fail('Unvollständiges Backup-Staging vorhanden', 409);
    }
    const temporary = `${folder}.tmp`;
    fs.mkdirSync(temporary, { mode: 0o700 });
    try {
        if (!fs.existsSync(DATA_FILE)) throw fail('Sammlungsdatei fehlt', 503);
        for (const [from, name] of [[DATA_DIR, 'data'], [IMAGE_DIR, 'images'], [DOCUMENT_DIR, 'documents']]) {
            const dest = path.join(temporary, name);
            if (fs.existsSync(from)) {
                fs.cpSync(from, dest, { recursive: true, dereference: false });
            } else {
                fs.mkdirSync(dest);
            }
        }
        // The atomic JSON writer guarantees the source file is always complete.
        JSON.parse(fs.readFileSync(path.join(temporary, 'data/collection.json'), 'utf8'));
        fs.renameSync(temporary, folder);
    } catch (error) {
        fs.rmSync(temporary, { recursive: true, force: true });
        throw error;
    }
    return { jobId, created: true };
}

/** Download ZIP archives only from marked local targets; never accept a client path. */
export function downloadLocalZip(req, profileId, filename) {
    authorizeAdmin(req);
    const data = profiles();
    const profile = data.profiles[findProfile(data, profileId)];
    if (profile.format !== 'zip' || profile.provider !== 'local') throw fail('Direkter Download ist derzeit nur für lokale ZIP-Backups verfügbar', 400);
    if (!ZIP_FILENAME.test(filename)) throw fail('Ungültiger Archivname', 400);
    const root = path.resolve(process.env.BACKUP_TARGET_ROOT || '/backup-targets');
    const repository = path.resolve(root, profile.targetPath);
    if (!repository.startsWith(root + path.sep)) throw fail('Ungültiges Backup-Ziel', 400);
    const marker = path.join(path.dirname(repository), '.whisky-backup-target');
    if (!fs.existsSync(marker) || !fs.lstatSync(marker).isFile()) throw fail('USB-Backup-Ziel nicht eingebunden', 409);
    try {
        const actualRepo = fs.realpathSync(repository);
        if (!actualRepo.startsWith(fs.realpathSync(root) + path.sep)) throw fail('Backup-Ziel nicht erlaubt', 403);
        const file = path.join(actualRepo, filename);
        if (!fs.lstatSync(file).isFile()) throw fail('Backup-Datei nicht gefunden', 404);
        return { path: file, filename, type: 'application/zip' };
    } catch (error) {
        if (error?.status) throw error;
        if (error.code === 'ENOENT') throw fail('Backup-Datei nicht gefunden', 404);
        throw error;
    }
}
