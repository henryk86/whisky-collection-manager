import {t} from '../i18n/index.js';
import {request} from '../api.js';

export const fileAccept = '.pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.txt,.csv,.eml,.docx,.xlsx,.odt,.ods';
const extensions = new Set(fileAccept.split(',').map(value => value.slice(1)));
const MAX_BYTES = 15 * 1024 * 1024;

/**
 * Formats file size for files.
 *
 * @param {number} bytes File length in bytes; non-finite values produce an empty label.
 * @return {string} Human-readable KB or MB value, or empty text when size is not finite.
 */
export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return '';
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toLocaleString('de-DE', {maximumFractionDigits: 1})} MB`
    : `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
}

/**
 * Validates file against its constraints.
 *
 * @param {*} file File resource to read, write or inspect.
 */
function validateFile(file) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extensions.has(extension)) {
    throw Error(t('errors.files.unsupportedType', {name: file.name}));
  }
  if (!file.size || file.size > MAX_BYTES) {
    throw Error(t('errors.files.invalidSize', {name: file.name}));
  }
}

/**
 * Converts the input into data url.
 *
 * @param {*} file File resource to read, write or inspect.
 * @return {!Promise<*>} Promise for the asynchronous operation.
 */
function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(Error(t('errors.files.readFailed', {name: file.name})));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload individually; the server stores binaries outside collection.json.
 *
 * @param {string} bottleId Identifier of the physical bottle.
 * @param {!Array<*>} files Files selected for the operation.
 * @return {!Promise<number>} Promise fulfilled when the operation completes.
 */
export async function uploadFiles(bottleId, files) {
  for (const file of files) validateFile(file);
  let saved = 0;
  for (const file of files) {
    try {
      await request(`/api/bottles/${encodeURIComponent(bottleId)}/files`, {
        method: 'POST',
        body: JSON.stringify({filename: file.name, data: await toDataUrl(file)}),
      });
      saved++;
    }
    catch (error) {
      throw Error(t('errors.files.partiallySaved', {saved, total: files.length, error: error.message}));
    }
  }
  return saved;
}
