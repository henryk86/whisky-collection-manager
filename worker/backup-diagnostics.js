/** Operator-only diagnostics. Never write command output into job status or API
 * responses. Redact common credentials, URLs and filesystem paths before
 * sending a bounded single-line entry to the container's stderr log. */
export function sanitizeBackupDiagnostic(raw) {
    if (typeof raw !== 'string' || !raw.trim()) return 'keine weiteren technischen Details';
    const clean = raw
        .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')
        .replace(/[\x00-\x1f\x7f]+/g, ' ')
        .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]*@/gi, '$1[Zugangsdaten]@')
        .replace(/([?&](?:access_token|refresh_token|password|secret|key|signature|code)=)[^\s&#]+/gi, '$1[geschuetzt]')
        .replace(/\b(Bearer|Basic)\s+[a-z0-9+/_.~=-]{8,}/gi, '$1 [geschuetzt]')
        .replace(/\b(password|passwd|access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key|authorization|secret|credential|credentials|key)["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1=[geschuetzt]')
        // Keep the diagnostic "couldn't fetch token: invalid_grant", but
        // redact tokens in key/value formats (including JSON error output).
        .replace(/(["']token["']\s*:\s*|\btoken\s*=\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1[geschuetzt]')
        .replace(/\b(?:[A-Za-z]:\\[^\s"']+|\/(?:[^\s/"']+\/)+[^\s"']+)/g, '[Pfad]')
        .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[E-Mail]')
        .replace(/\b[a-z0-9_+/-]{48,}={0,2}\b/gi, '[langer Wert]')
        .replace(/\s+/g, ' ').trim();
    let redacted = clean;
    // External programs may echo values without key names. Known configured
    // secrets are additionally masked. Secret files are never read for logging.
    for (const key of ['RESTIC_PASSWORD', 'RCLONE_CONFIG_PASS', 'AWS_SECRET_ACCESS_KEY',
        'AWS_ACCESS_KEY_ID', 'AZURE_STORAGE_KEY', 'BACKUP_WORKER_TOKEN']) {
        const value = process.env[key];
        if (typeof value === 'string' && value.length >= 6) redacted = redacted.replaceAll(value, '[geschuetzt]');
    }
    return redacted.slice(-700) || 'keine weiteren technischen Details';
}

/** The error's diagnostic stays in memory. serializeBackupJobError ignores it. */
export function commandFailureDiagnostic(binary, code, signal, output) {
    const exit = signal ? `Signal ${String(signal).replace(/[^A-Z0-9]/g, '')}` :
        Number.isInteger(code) ? `Exit ${code}` : 'Startfehler';
    return `${binary} (${exit}): ${sanitizeBackupDiagnostic(output)}`;
}

export function logBackupJobFailure(jobId, serialized, error) {
    const diagnostic = typeof error?.backupDiagnostic === 'string' ? sanitizeBackupDiagnostic(error.backupDiagnostic) :
        typeof error?.code === 'string' && /^[A-Z0-9_]{2,24}$/.test(error.code) ? `Systemcode ${error.code}` :
            'keine weiteren technischen Details';
    // Never log exception objects or raw .message; these can contain credentials.
    console.error(`[Backup-Worker] Auftrag ${jobId} fehlgeschlagen (${serialized.errorCode}): ${diagnostic}`);
}
