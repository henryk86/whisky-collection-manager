/** Backup background process in the same Docker container as the HTTPS app.
 * Uses ZIP for new backups, Rclone for cloud and Restic only for old snapshots.
 * Asks the app for a consistent staging snapshot over
 * certificate-verified HTTPS loopback. It never modifies the live collection. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeReadableZip, inspectReadableZip } from '../shared/backup-zip.js';
import { readBackupPassword } from '../shared/backup-password.js';

const CONTROL = path.resolve(process.env.BACKUP_CONTROL_DIR || '/backup-control');
const LOCAL_ROOT = path.resolve(process.env.BACKUP_TARGET_ROOT || '/backup-targets');
const TZ = process.env.BACKUP_TIME_ZONE || 'Europe/Berlin';
const APP = process.env.APP_INTERNAL_URL || 'https://127.0.0.1:3543';
if (process.env.NODE_ENV === 'production') {
    const url = new URL(APP);
    if (url.protocol !== 'https:' || !['127.0.0.1', 'localhost'].includes(url.hostname)) {
        throw new Error('Backup-Verbindung muss HTTPS auf localhost verwenden.');
    }
}
const SAFE_REMOTE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,49}$/;
const SAFE_ID = /^[0-9a-f]{8}-[0-9a-f-]{20,50}$/i;
const SAFE_PATH = /^[a-zA-Z0-9 _./-]{1,180}$/;
const TYPES = new Set(['run', 'check', 'test', 'snapshots', 'restore', 'prepare']);
const ZIP_FILE = /^whisky-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(?:-\d{3})?-[0-9a-f]{8}\.zip$/i;
const timeFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    weekday: 'short', hourCycle: 'h23'
});

export function localClock(now = new Date()) {
    const parts = Object.fromEntries(timeFormatter.formatToParts(now).map(part => [part.type, part.value]));
    return {
        date: `${parts.year}-${parts.month}-${parts.day}`,
        hour: Number(parts.hour), minute: Number(parts.minute),
        weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday)
    };
}
export function dueSlot(profile, now = new Date()) {
    if (!profile.enabled || profile.format !== 'zip') return null; // No more automatic Restic backups
    const time = localClock(now);
    const schedule = profile.schedule;
    if (!schedule || !['hourly','daily','weekly'].includes(schedule.frequency)) return null;
    if (schedule.frequency === 'hourly') return time.minute >= schedule.minute ? `${time.date}T${String(time.hour).padStart(2, '0')}` : null;
    if (time.hour * 60 + time.minute < schedule.hour * 60 + schedule.minute) return null;
    if (schedule.frequency === 'weekly' && time.weekday !== schedule.weekday) return null;
    return time.date;
}
function readJson(name, fallback) {
    try { return JSON.parse(fs.readFileSync(path.join(CONTROL, name), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}
function writeJson(name, value) {
    fs.mkdirSync(CONTROL, { recursive: true, mode: 0o700 });
    const to = path.join(CONTROL, name);
    const temp = `${to}.${crypto.randomUUID()}.tmp`;
    try {
        fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
        fs.renameSync(temp, to);
    } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}
function cleanRelative(raw) {
    if (typeof raw !== 'string' || !SAFE_PATH.test(raw) || raw.startsWith('/') || raw.endsWith('/') || raw.split('/').some(p => !p || p.startsWith('.') || p === '..')) {
        throw Error('Ungültiger Zielpfad');
    }
    return raw;
}
export function repositoryFor(profile) {
    const target = cleanRelative(profile.targetPath);
    if (profile.provider === 'local') {
        const result = path.resolve(LOCAL_ROOT, target);
        if (!result.startsWith(LOCAL_ROOT + path.sep)) throw Error('Unzulässiges lokales Backup-Ziel');
        // Refuse to silently write to the SD card if a USB/NAS mount went away.
        const drive = path.join(LOCAL_ROOT, target.split('/')[0]);
        const marker = path.join(drive, '.whisky-backup-target');
        if (!fs.existsSync(marker) || !fs.lstatSync(marker).isFile()) {
            throw Error(`Backup-Marker fehlt: ${marker}. USB/NAS-Laufwerk korrekt eingehängt?`);
        }
        if (fs.existsSync(result)) {
            const actual = fs.realpathSync(result);
            if (!actual.startsWith(fs.realpathSync(LOCAL_ROOT) + path.sep)) throw Error('Backup-Ziel liegt außerhalb des erlaubten Bereichs');
        }
        return result;
    }
    if (typeof profile.remote !== 'string' || !SAFE_REMOTE.test(profile.remote)) throw Error('Ungültige Rclone-Verbindung');
    return `rclone:${profile.remote}:${target}`;
}
function loadProfiles() {
    const data = readJson('profiles.json', { version: 1, profiles: [] });
    if (data.version !== 1 || !Array.isArray(data.profiles)) throw Error('Ungültige Profile');
    return data.profiles;
}
function jobEnv() {
    const password = process.env.RESTIC_PASSWORD_FILE || '/run/secrets/restic-password';
    const config = process.env.RCLONE_CONFIG || '/config/rclone/rclone.conf';
    return { ...process.env, RESTIC_PASSWORD_FILE: password, RCLONE_CONFIG: config, RESTIC_CACHE_DIR: path.join(CONTROL, 'restic-cache') };
}
export function runCommand(binary, args, { cwd, timeout = 3600000 } = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(binary, args, { cwd, env: jobEnv(), stdio: ['ignore', 'pipe', 'pipe'], shell: false });
        let output = '';
        const capture = part => { output = (output + part.toString('utf8')).slice(-120000); };
        child.stdout.on('data', capture);
        child.stderr.on('data', capture);
        const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
        child.on('error', err => { clearTimeout(timer); reject(err); });
        child.on('close', (code, signal) => {
            clearTimeout(timer);
            if (code === 0) resolve(output);
            else reject(Error(`${binary} (${code ?? signal}): ${output.trim().slice(-1800)}`));
        });
    });
}
const restic = (repo, args, options) => runCommand('restic', ['-r', repo, ...args], options);
async function snapshots(repo) {
    const raw = await restic(repo, ['snapshots', '--json'], { timeout: 120000 });
    const entries = JSON.parse(raw);
    return (Array.isArray(entries) ? entries : []).slice(-80).reverse().map(x => ({
        id: x.id, shortId: x.short_id || x.id?.slice(0, 8), time: x.time,
        paths: x.paths, hostname: x.hostname, tags: x.tags || []
    }));
}
function formatOf(profile) {
    // Existing profiles have no format field and must keep their Restic repositories.
    return profile.format === 'zip' ? 'zip' : 'restic';
}
function archiveName(job) {
    const timestamp = new Date().toISOString().slice(0, 23).replace(/[:.]/g, '-');
    return `whisky-backup-${timestamp}-${job.id.slice(0, 8)}.zip`;
}
async function zipFilesFor(profile, repo) {
    let entries;
    if (profile.provider === 'local') {
        try {
            entries = fs.readdirSync(repo, { withFileTypes: true }).filter(d => d.isFile() && ZIP_FILE.test(d.name))
                .map(d => ({ name: d.name, size: fs.statSync(path.join(repo, d.name)).size }));
        } catch (error) { if (error.code === 'ENOENT') entries = []; else throw error; }
    } else {
        const output = await runCommand('rclone', ['lsjson', '--files-only', repo], { timeout: 120000 });
        entries = JSON.parse(output).filter(item => ZIP_FILE.test(item.Name) && !item.IsDir)
            .map(item => ({ name: item.Name, size: item.Size }));
    }
    return entries.sort((a, b) => b.name.localeCompare(a.name)).map(entry => ({
        id: entry.name, filename: entry.name, shortId: entry.name.slice(14, 33).replace('T', ' '),
        time: `${entry.name.slice(14, 24)}T${entry.name.slice(25, 27)}:${entry.name.slice(28, 30)}:${entry.name.slice(31, 33)}.${entry.name[33] === '-' && /\d{3}/.test(entry.name.slice(34, 37)) ? entry.name.slice(34, 37) : '000'}Z`,
        size: entry.size, format: 'zip'
    }));
}
function weekBucket(time) {
    const d = new Date(time);
    d.setUTCHours(0, 0, 0, 0);
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    return `${d.getUTCFullYear()}-${Math.ceil((((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000) + 1) / 7)}`;
}
export function selectZipRetention(items, retention) {
    const keep = new Set(items.length ? [items[0].id] : []);
    for (const [rule, keyOf] of [
        ['daily', item => item.time.slice(0, 10)],
        ['weekly', item => weekBucket(item.time)],
        ['monthly', item => item.time.slice(0, 7)]
    ]) {
        const seen = new Set();
        for (const item of items) {
            const key = keyOf(item);
            if (seen.has(key)) continue;
            if (seen.size >= (retention?.[rule] || 0)) break;
            seen.add(key); keep.add(item.id);
        }
    }
    return keep;
}
async function zipPrune(profile, repo, items) {
    const keep = selectZipRetention(items, profile.retention);
    for (const item of items) {
        if (keep.has(item.id)) continue;
        if (profile.provider === 'local') fs.unlinkSync(path.join(repo, item.filename));
        else await runCommand('rclone', ['deletefile', `${repo}/${item.filename}`], { timeout: 120000 });
    }
    return items.filter(item => keep.has(item.id));
}
async function runZipBackup(job, profile, repo, status) {
    const folder = await ensureSourceSnapshot(job);
    const local = profile.provider === 'local';
    const filename = archiveName(job);
    if (local && fs.existsSync(path.join(repo, 'config'))) throw Error('Ziel ist ein altes Restic-Repository. Für ZIP einen neuen Ordner wählen.');
    const tempFolder = local ? repo : path.join(CONTROL, 'zip-temp', job.id);
    fs.mkdirSync(tempFolder, { recursive: true, mode: 0o700 });
    const temporary = path.join(tempFolder, `.${filename}.part`);
    const finished = path.join(tempFolder, filename);
    try {
        const password = readBackupPassword();
        writeReadableZip(folder, temporary, password);
        // Authenticate every AES-256 entry before publishing to the target.
        inspectReadableZip(temporary, null, password);
        if (local) fs.renameSync(temporary, finished);
        else {
            fs.renameSync(temporary, finished);
            await runCommand('rclone', ['copyto', finished, `${repo}/${filename}`], { timeout: 3600000 });
        }
        status.snapshots[profile.id] = await zipPrune(profile, repo, await zipFilesFor(profile, repo));
        return { message: 'AES-256-geschütztes ZIP-Backup erstellt (Sammlung, Bilder und Dokumente)',
            snapshotCount: status.snapshots[profile.id].length, filename };
    } finally {
        fs.rmSync(folder, { recursive: true, force: true });
        fs.rmSync(temporary, { force: true });
        if (!local) fs.rmSync(tempFolder, { recursive: true, force: true });
    }
}
/** Legacy Restic is read-only: convert an old snapshot into the same ZIP format for preview/apply. */
async function prepareLegacyRestore(job, repo) {
    if (!/^(latest|[0-9a-f]{8,64})$/i.test(job.snapshotId || '')) throw Error('Ungültige Restic-Snapshot-ID');
    const folder = path.join(CONTROL, 'imports', job.id);
    const extracted = path.join(folder, 'preview');
    fs.mkdirSync(extracted, { recursive: true, mode: 0o700 });
    try {
        await restic(repo, ['restore', job.snapshotId, '--target', extracted], { timeout: 3600000 });
        const archive = path.join(folder, 'uploaded.zip');
        const password = readBackupPassword();
        writeReadableZip(extracted, archive, password);
        inspectReadableZip(archive, null, password);
        return { message: 'Altes Restic-Backup in prüfbares ZIP umgewandelt', importId: job.id, filename: 'altes-restic-backup.zip' };
    } catch (error) {
        fs.rmSync(folder, { recursive: true, force: true });
        throw error;
    }
}
/** Prepare a selected saved ZIP for the same preview/confirmation used by browser uploads. */
async function prepareZipRestore(job, profile, repo) {
    const archives = await zipFilesFor(profile, repo);
    const selected = job.snapshotId === 'latest' ? archives[0] : archives.find(item => item.id === job.snapshotId);
    if (!selected) throw Error('Sicherungsstand nicht gefunden');
    const folder = path.join(CONTROL, 'imports', job.id);
    fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
    const target = path.join(folder, 'uploaded.zip');
    try {
        if (profile.provider === 'local') {
            const source = path.join(repo, selected.filename);
            if (!fs.lstatSync(source).isFile()) throw Error('Keine reguläre ZIP-Datei');
            fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL);
        } else {
            await runCommand('rclone', ['copyto', `${repo}/${selected.filename}`, target], { timeout: 3600000 });
        }
        // Password supplied later via the authenticated browser; never store it in queue/status files.
        return { message: 'ZIP zur Passwortprüfung bereit', importId: job.id, filename: selected.filename };
    } catch (error) {
        fs.rmSync(folder, { recursive: true, force: true });
        throw error;
    }
}

async function ensureSourceSnapshot(job) {
    const file = process.env.BACKUP_WORKER_TOKEN_FILE || '/run/secrets/backup-worker-token';
    const token = fs.readFileSync(file, 'utf8').trim();
    const result = await fetch(`${APP}/internal/backup/snapshot/${job.id}`, {
        method: 'POST', headers: { 'X-Backup-Worker-Token': token, 'Content-Type': 'application/json' },
        body: '{}', signal: AbortSignal.timeout(120000)
    });
    if (!result.ok) throw Error(`App konnte keinen konsistenten Stand erstellen: HTTP ${result.status} ${(await result.text()).slice(0, 300)}`);
    const folder = path.join(CONTROL, 'staging', job.id);
    if (!fs.statSync(path.join(folder, 'data/collection.json')).isFile()) throw Error('Quell-Snapshot enthält keine collection.json');
    return folder;
}
export async function executeJob(job, profile, status) {
    const repo = repositoryFor(profile);
    if (job.type === 'test') {
        // Test writes, not just read-only directory listings.
        const probe = `.whisky-write-test-${job.id}`;
        if (profile.provider === 'local') {
            fs.mkdirSync(repo, { recursive: true, mode: 0o700 });
            const testFile = path.join(repo, probe);
            fs.writeFileSync(testFile, 'test', { flag: 'wx', mode: 0o600 });
            fs.unlinkSync(testFile);
        } else {
            const probePath = path.join(CONTROL, probe);
            fs.writeFileSync(probePath, 'test', { flag: 'wx', mode: 0o600 });
            try {
                await runCommand('rclone', ['copyto', probePath, `${repo}/${probe}`], { timeout: 120000 });
                await runCommand('rclone', ['deletefile', `${repo}/${probe}`], { timeout: 120000 });
            } finally { fs.rmSync(probePath, { force: true }); }
        }
        return { message: 'Schreibtest erfolgreich: Backup-Ziel ist bereit' };
    }
    if (job.type === 'prepare') {
        return formatOf(profile) === 'zip' ? prepareZipRestore(job, profile, repo) : prepareLegacyRestore(job, repo);
    }
    if (job.type === 'run') {
        if (formatOf(profile) !== 'zip') throw Error('Altes Restic-Profil: keine neuen Backups. Bitte auf ZIP umstellen.');
        return runZipBackup(job, profile, repo, status);
    }
    if (job.type === 'check' && formatOf(profile) === 'zip') {
        const archives = await zipFilesFor(profile, repo);
        if (!archives.length) throw Error('Noch keine ZIP-Sicherungen vorhanden');
        for (const item of archives) {
            if (profile.provider === 'local') inspectReadableZip(path.join(repo, item.filename), null, readBackupPassword());
            else {
                const folder = path.join(CONTROL, 'zip-temp', job.id);
                fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
                try {
                    const file = path.join(folder, item.filename);
                    await runCommand('rclone', ['copyto', `${repo}/${item.filename}`, file]);
                    inspectReadableZip(file, null, readBackupPassword());
                } finally { fs.rmSync(folder, { recursive: true, force: true }); }
            }
        }
        return { message: `${archives.length} ZIP-Datei(en) inklusive AES-Authentifizierung kontrolliert` };
    }
    if (job.type === 'check') {
        await restic(repo, ['check'], { timeout: 3600000 });
        return { message: 'Restic-Repository geprüft (Struktur/Metadaten)' };
    }
    if (job.type === 'snapshots') {
        status.snapshots[profile.id] = formatOf(profile) === 'zip' ? await zipFilesFor(profile, repo) : await snapshots(repo);
        return { message: `${status.snapshots[profile.id].length} Sicherungsstände geladen` };
    }
    if (job.type === 'restore') {
        if (formatOf(profile) === 'zip') throw Error('ZIP-Sicherungen über die Vorschau einspielen.');
        const snapshotId = job.snapshotId;
        if (!/^(latest|[0-9a-f]{8,64})$/i.test(snapshotId || '')) throw Error('Ungültige Snapshot-ID');
        const target = path.join(CONTROL, 'restores', profile.id, job.id);
        fs.mkdirSync(target, { recursive: true, mode: 0o700 });
        try {
            await restic(repo, ['restore', snapshotId, '--target', target]);
        } catch (error) {
            fs.rmSync(target, { recursive: true, force: true });
            throw error;
        }
        return { message: 'Wiederherstellung in separaten Prüf-Ordner abgeschlossen. Laufende Sammlung unverändert.', restorePath: target };
    }
    throw Error('Unbekannter Auftrags-Typ');
}
const EMPTY_STATUS = { updatedAt: null, timeZone: TZ, jobs: [], snapshots: {}, remotes: [] };
export function createWorker() {
    const status = readJson('worker-status.json', EMPTY_STATUS);
    status.jobs = (status.jobs || []).map(job => job.state === 'running' ? { ...job, state: 'failed', error: 'Worker wurde während des Auftrags beendet' } : job);
    status.snapshots ||= {};
    status.remotes ||= [];
    const schedule = readJson('schedule-state.json', {});
    let busy = false;
    function flush() {
        status.updatedAt = new Date().toISOString();
        status.timeZone = TZ;
        status.jobs = status.jobs.slice(0, 100);
        writeJson('worker-status.json', status);
    }
    async function loadRemotes() {
        try {
            const result = await runCommand('rclone', ['listremotes'], { timeout: 15000 });
            status.remotes = result.split(/\r?\n/).map(s => s.trim().replace(/:$/, '')).filter(s => SAFE_REMOTE.test(s));
        } catch { status.remotes = []; }
    }
    function scheduleDue() {
        for (const profile of loadProfiles()) {
            const slot = dueSlot(profile);
            if (!slot || schedule[profile.id] === slot) continue;
            const job = { id: crypto.randomUUID(), profileId: profile.id, type: 'run', createdAt: new Date().toISOString(), scheduled: true };
            const file = path.join(CONTROL, 'jobs', `${job.id}.json`);
            fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
            fs.writeFileSync(file, JSON.stringify(job), { flag: 'wx', mode: 0o600 });
            schedule[profile.id] = slot;
            writeJson('schedule-state.json', schedule);
        }
    }
    async function processQueue() {
        if (busy) return;
        busy = true;
        try {
            scheduleDue();
            const dir = path.join(CONTROL, 'jobs');
            fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
            const files = fs.readdirSync(dir).filter(f => SAFE_ID.test(f.replace(/\.json$/, '')) && f.endsWith('.json')).sort();
            for (const file of files) {
                const full = path.join(dir, file);
                let job;
                try { job = JSON.parse(fs.readFileSync(full, 'utf8')); }
                catch { fs.unlinkSync(full); continue; }
                if (!SAFE_ID.test(job.id) || file !== `${job.id}.json` || !SAFE_ID.test(job.profileId) || !TYPES.has(job.type)) {
                    fs.unlinkSync(full); continue;
                }
                const log = { ...job, state: 'running', startedAt: new Date().toISOString() };
                status.jobs.unshift(log);
                flush();
                try {
                    const profile = loadProfiles().find(profile => profile.id === job.profileId);
                    if (!profile) throw Error('Profil existiert nicht mehr');
                    const result = await executeJob(job, profile, status);
                    Object.assign(log, { state: 'success', finishedAt: new Date().toISOString(), ...result });
                } catch (error) {
                    Object.assign(log, { state: 'failed', finishedAt: new Date().toISOString(), error: String(error.message || error).slice(0, 1500) });
                } finally {
                    fs.unlinkSync(full);
                    flush();
                }
            }
        } finally { busy = false; flush(); }
    }
    async function start() {
        await loadRemotes();
        flush();
        await processQueue();
        // Unref is not used: the worker must stay alive to execute schedules.
        setInterval(() => {
            processQueue().catch(error => console.error('Backup-Worker:', error));
        }, 15000);
        setInterval(() => { loadRemotes().then(flush).catch(console.error); }, 300000);
        console.log(`Backup-Worker gestartet (Zeitzone: ${TZ})`);
    }
    return { start, processQueue, getStatus: () => status };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    createWorker().start().catch(error => { console.error(error); process.exitCode = 1; });
}
