import { t } from './index.js';
import { apiErrorCode } from './api-error-codes.js';

/** Worker messages are untrusted and may be localized to any language. */
export function jobErrorText(message) {
    const code = typeof message === 'string' ? apiErrorCode(message) : null;
    return code ? t(code) : t('backups.jobs.failed');
}
