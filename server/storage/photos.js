/** Photo bytes are stored separately; collection.json contains relative paths only. */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, IMAGE_DIR } from './paths.js';
import { assert } from '../domain/errors.js';
export function imagePath(id, kind, ext) {
    return `images/${id}/${kind}.${ext}`;
}
export function deleteImage(p) {
    if (p) {
        const file = path.join(ROOT, p);
        if (file.startsWith(IMAGE_DIR + path.sep) && fs.existsSync(file)) {
            fs.unlinkSync(file);
        }
    }
}
export function validateImageData(base64) {
    assert(typeof base64 === 'string' && base64.length < 20000000, 'Bild zu groß (maximal 10 MB)');
    const m = /^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(base64);
    assert(m, 'Bildformat nicht unterstützt (JPEG, PNG, WebP oder GIF)');
    const bytes = Buffer.from(m[2], 'base64');
    assert(bytes.length <= 10000000 && bytes.length > 0, 'Bild zu groß oder leer');
    const signatures = {
        jpeg: bytes[0] === 0xff && bytes[1] === 0xd8, png: bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), webp: bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP', gif: bytes.toString('ascii', 0, 3) === 'GIF'
    };
    assert(signatures[m[1]], 'Bildinhalt entspricht nicht dem Dateiformat');
    return { bytes, ext: m[1] === 'jpeg' ? 'jpg' : m[1], mediaType: `image/${m[1]}` };
}
export function saveImage(base64, id, kind) {
    const { bytes, ext } = validateImageData(base64);
    const dir = path.join(IMAGE_DIR, id);
    fs.mkdirSync(dir, {
        recursive: true
    });
    const target = path.join(dir, `${kind}.${ext}`);
    fs.writeFileSync(target, bytes, {
        flag: 'w', mode: 0o600
    });
    return imagePath(id, kind, ext);
}
