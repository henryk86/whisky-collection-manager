import { request } from '../api.js';

export const fileAccept = '.pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.txt,.csv,.eml,.docx,.xlsx,.odt,.ods';
const extensions = new Set(fileAccept.split(',').map(value => value.slice(1)));
const MAX_BYTES = 15 * 1024 * 1024;

export function formatFileSize(bytes) {
    if (!Number.isFinite(bytes)) return '';
    return bytes >= 1024 * 1024
        ? `${(bytes / (1024 * 1024)).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`
        : `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
}
function validateFile(file) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extensions.has(extension)) {
        throw Error(`Dateityp nicht unterstuetzt: ${file.name}`);
    }
    if (!file.size || file.size > MAX_BYTES) {
        throw Error(`Datei leer oder groesser als 15 MB: ${file.name}`);
    }
}
function toDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(Error(`Datei konnte nicht gelesen werden: ${file.name}`));
        reader.readAsDataURL(file);
    });
}
/** Upload individually; the server stores binaries outside collection.json. */
export async function uploadFiles(bottleId, files) {
    for (const file of files) validateFile(file);
    let saved = 0;
    for (const file of files) {
        try {
            await request(`/api/bottles/${encodeURIComponent(bottleId)}/files`, {
                method: 'POST',
                body: JSON.stringify({ filename: file.name, data: await toDataUrl(file) })
            });
            saved++;
        }
        catch (error) {
            throw Error(`${saved} von ${files.length} Dateien gespeichert. ${error.message}`);
        }
    }
    return saved;
}
