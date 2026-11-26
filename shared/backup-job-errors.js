/**
 * Creates an error carrying a stable backup job code and interpolation values.
 * @param {string} code Backup job error code.
 * @param {Object=} params Error message interpolation parameters.
 * @return {Error & {backupJobCode: string, backupJobParams: Object}} Error carrying structured backup details.
 */
export function backupJobError(code, params = {}) {
  return Object.assign(new Error(code), {backupJobCode: code, backupJobParams: params});
}

/**
 * Serializes backup job error for backup job errors.
 *
 * @param {*} error Error being handled.
 * @return {!Object} Structured result for the caller.
 */
export function serializeBackupJobError(error) {
  if (typeof error?.backupJobCode === 'string' && /^backup\.errors\.[a-zA-Z0-9]+$/.test(error.backupJobCode)) {
    // Only HTTP status is intentionally public; no arbitrary paths, command
    // output, filenames or secret-bearing values may become UI parameters.
    const status = error.backupJobParams?.status;
    const params = error.backupJobCode === 'backup.errors.sourceSnapshotFailed' && typeof status === 'string' && /^[1-5]\d{2}$/.test(status) ? {status} : {};
    return {
      errorCode: error.backupJobCode,
      ...(Object.keys(params).length ? {errorParams: params} : {}),
    };
  }
  if (error?.backupCommand === 'rclone') return {errorCode: 'backup.errors.rcloneFailed'};
  if (error?.backupCommand === 'restic') return {errorCode: 'backup.errors.resticFailed'};
  if (error?.code === 'ENOSPC') return {errorCode: 'backup.errors.diskFull'};
  if (error?.code === 'EACCES' || error?.code === 'EPERM' || error?.code === 'EROFS') {
    return {errorCode: 'backup.errors.permissionDenied'};
  }
  if (error?.code === 'ENOENT') return {errorCode: 'backup.errors.missingFile'};
  return {errorCode: 'backup.errors.unexpected'};
}
