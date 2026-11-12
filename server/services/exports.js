import fs from 'node:fs';
import path from 'node:path';
import { read } from '../storage/collection-store.js';
import { ROOT, DATA_FILE, BACKUP_DIR } from '../storage/paths.js';
import { csv } from '../exports/csv.js';
import crypto from 'node:crypto';
import { writeReadableZip, inspectReadableZip } from '../../shared/backup-zip.js';
import { readBackupPassword } from '../../shared/backup-password.js';
import { authorizeAdmin } from './backups.js';
import { fail } from '../domain/errors.js';
const statusCodes = {
    closed: 'Geschlossen', open: 'Geöffnet', empty: 'Leer'
};
export function exportJson() {
    return {
        filename: 'collection.json', type: 'application/json; charset=utf-8', bytes: fs.readFileSync(DATA_FILE)
    };
}
export function exportCsv() {
    const db = read();
    const ds = new Map(db.distilleries.map(d => [d.id, d.name]));
    const rows = [['Inventarnummer', 'Status', 'Destillerien', 'Whisky-Kategorie', 'Marke', 'Abfüller', 'Zusammensetzung vollständig', 'Whiskyname', 'Alter', 'Erscheinungsjahr', 'Destillationsdatum', 'Abfülldatum', 'Alkohol %', 'Flaschentyp', 'Größe ml', 'Kaufdatum', 'Kaufpreis', 'Währung', 'Händler', 'Kommentar', 'Whiskybase', 'Flaschenfotos (Pfade)', 'Dateianhaenge (Pfade)']];
    for (const b of db.bottlings) {
        for (const bottle of b.bottles) {
            rows.push([bottle.inventoryNumber, statusCodes[bottle.status], (b.distilleryIds || [b.distilleryId].filter(Boolean)).map(id => ds.get(id) || id).join(' | '), b.whiskyType, b.brand, b.bottler, b.compositionComplete, b.name, b.ageYears, b.releaseYear, b.distillationDate || b.distillationYear, b.bottlingDate || b.bottlingYear, b.abv, bottle.volumeType === 'sample' ? 'Sample' : 'Normal', bottle.volumeMl ?? (bottle.volumeType === 'sample' ? null : b.volumeMl), bottle.purchaseDate, bottle.purchasePrice, bottle.currency, bottle.merchant, bottle.comment, b.whiskybaseUrl, (bottle.photos || []).flatMap(p => [p.path, p.cutout?.path].filter(Boolean)).join(' | '), (bottle.files || []).map(f => f.path).join(' | ')]);
        }
    }
    return {
        filename: 'whisky-sammlung.csv', type: 'text/csv; charset=utf-8', bytes: csv(rows)
    };
}
/** The manual download uses exactly the same readable ZIP builder as the scheduler. */
export function exportZip(req) {
    authorizeAdmin(req);
    let password;
    try { password = readBackupPassword(); }
    catch (error) { throw fail(error.message, 409); }
    fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString().slice(0, 23).replace(/[:.]/g, '-');
    const filename = `whisky-backup-${timestamp}-${id.slice(0, 8)}.zip`;
    const temporary = path.join(BACKUP_DIR, `.download-${id}.zip`);
    try {
        writeReadableZip(ROOT, temporary, password);
        inspectReadableZip(temporary, null, password);
        return { filename, type: 'application/zip', path: temporary, cleanup: true };
    } catch (error) {
        fs.rmSync(temporary, { force: true });
        throw error;
    }
}
