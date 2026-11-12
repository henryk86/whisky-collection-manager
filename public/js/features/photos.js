import { t } from '../i18n/index.js';
import { request } from '../api.js';
export async function imageData(file) {
    if (file.size > 10000000) {
        throw Error(t('features.validation.photoTooLarge'));
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
        throw Error(t('features.validation.photoUnsupported'));
    }
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(Error(t('features.validation.photoUnreadable')));
        r.readAsDataURL(file);
    });
}
export async function uploadPhotos(bottleId, files) {
    for (const file of files) {
        await request(`/api/bottles/${bottleId}/photos`, {
            method: 'POST', body: JSON.stringify({
                image: await imageData(file)
            })
        });
    }
}
