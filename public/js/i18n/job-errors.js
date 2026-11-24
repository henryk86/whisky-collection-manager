import {t} from './index.js';
import {apiErrorCode} from '../../../shared/api-error-codes.js';

/**
 * New jobs use stable keys; legacy status files remain readable without
 * rendering their untrusted diagnostic text.
 *
 * @param {*} job Job used by this operation.
 * @return {*} Entries that meet the selection criteria.
 */
export function jobErrorText(job) {
  if (job && typeof job === 'object') {
    const code = job.errorCode;
    if (typeof code === 'string' && /^backup\.errors\.[a-zA-Z0-9]+$/
      .test(code)) {
      const params = job.errorParams && typeof job.errorParams ===
        'object' && !Array.isArray(job.errorParams)
        ? Object.fromEntries(Object.entries(job.errorParams)
          .filter(([key, value]) =>
            /^[a-zA-Z]\w*$/.test(key) && typeof value === 'string' &&
            value.length <= 100)) : {};
      const translated = t(code, params);
      if (translated !== code) return translated;
    }
    return jobErrorText(job.error);
  }
  // Historical jobs may contain old API diagnostics. Unknown text is never
  // shown.
  const code = typeof job === 'string' ? apiErrorCode(job) : null;
  return code ? t(code) : t('backups.jobs.failed');
}
