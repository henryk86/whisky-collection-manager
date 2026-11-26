/**
 * Shared contracts for worker configuration and the profile editor.
 * The service remains responsible for validating incoming JSON.
 */

/** @typedef {'local'|'dropbox'|'google-drive'|'onedrive'|'sftp'|'s3'|'webdav'|'other'} BackupProvider */
/**
 * Local-time schedule used by the backup worker.
 * @typedef {Object} BackupSchedule
 * @property {'hourly'|'daily'|'weekly'} frequency Run interval.
 * @property {number} hour Hour of day (0–23).
 * @property {number} minute Minute (0–59).
 * @property {number} weekday Day of week (0 = Sunday, 6 = Saturday).
 */
/**
 * Retention counts for each archive period; zero disables that period.
 * @typedef {{daily: number, weekly: number, monthly: number}} BackupRetention
 */
/**
 * Validated configuration for a new ZIP profile, before persistence assigns an ID.
 * @typedef {Object} BackupProfileConfig
 * @property {string} name Display name.
 * @property {BackupProvider} provider Storage backend.
 * @property {'zip'} format Newly supported archive format.
 * @property {string} remote Rclone connection name; empty for local storage.
 * @property {string} targetPath Relative destination; local targets have drive/folder form.
 * @property {boolean} enabled Whether scheduled backups run automatically.
 * @property {BackupSchedule} schedule Normalized schedule.
 * @property {BackupRetention} retention Normalized retention policy, not all zero.
 */
/**
 * Existing profile data may be incomplete in an editor draft; old persisted
 * profiles may still use restic, which cannot be saved as a new restic profile.
 * @typedef {Partial<Omit<BackupProfileConfig, 'format'|'schedule'|'retention'>> & {id?: string, format?: 'zip'|'restic', schedule?: Partial<BackupSchedule>, retention?: Partial<BackupRetention>}} BackupProfileDraft
 */
/** @typedef {{name: string, label: string}} BackupTarget */
export {};
