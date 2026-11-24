/**
 * Stable worker-to-UI diagnostics. Never serialize the original exception
 * text, command output, local paths, credentials or a stack trace into job
 * status.
 *
 * @param {string} code Stable identifier used for error handling.
 * @param {!Object=} params Named values used when formatting the message.
 * @return {!Error} Result computed from the supplied inputs.
 */
export function backupJobError(code, params = {}) {
  const error = new Error(code);
  error.backupJobCode = code;
  error.backupJobParams = params;
  return error;
}

/**
 * Serializes backup job error for backup job errors.
 *
 * @param {*} error Error being handled.
 * @return {!Object} Structured result for the caller.
 */
export function serializeBackupJobError(error) {
  if (typeof error?.backupJobCode === 'string' &&
    /^backup\.errors\.[a-zA-Z0-9]+$/.test(error.backupJobCode)) {
    // Only HTTP status is intentionally public; no arbitrary paths, command
    // output, filenames or secret-bearing values may become UI parameters.
    const status = error.backupJobParams?.status;
    const params = error.backupJobCode ===
      'backup.errors.sourceSnapshotFailed' &&
      typeof status === 'string' && /^[1-5]\d{2}$/.test(status) ? {status} : {};
    return {
      errorCode: error.backupJobCode,
      ...(Object.keys(params).length ? {errorParams: params} : {}),
    };
  }
  if (error?.backupCommand ===
    'rclone') return {errorCode: 'backup.errors.rcloneFailed'};
  if (error?.backupCommand ===
    'restic') return {errorCode: 'backup.errors.resticFailed'};
  if (error?.code === 'ENOSPC') return {errorCode: 'backup.errors.diskFull'};
  if (error?.code === 'EACCES' || error?.code === 'EPERM' || error?.code ===
    'EROFS') {
    return {errorCode: 'backup.errors.permissionDenied'};
  }
  if (error?.code === 'ENOENT') return {errorCode: 'backup.errors.missingFile'};
  return {errorCode: 'backup.errors.unexpected'};
}
