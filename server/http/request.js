import { fail } from '../domain/errors.js';
/** Accept a JSON object, not arrays/primitives, with a hard upper size limit. */
export async function readJson(request) {
    // JSON is never accepted as text/plain: otherwise a cross-site HTML form
    // can write data without a CORS preflight.
    const mediaType = (request.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
    if (mediaType !== 'application/json') {
        throw fail('Content-Type muss application/json sein', 415);
    }
    const chunks = [];
    let bytes = 0;
    for await (const chunk of request) {
        bytes += chunk.length;
        if (bytes > 26 * 1024 * 1024) {
            throw fail('Anfrage zu groß', 413);
        }
        chunks.push(chunk);
    }
    let value;
    try {
        value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }
    catch {
        throw fail('Ungültiges JSON');
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw fail('JSON-Anfrage muss ein Objekt sein');
    }
    return value;
}
